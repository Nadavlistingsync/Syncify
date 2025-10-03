import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('memories')
      .select('*')
      .eq('user_id', user.id)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching memories:', error)
      return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Memories API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, content, importance, pii } = body

    if (!content) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 })
    }

    // Insert memory
    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: user.id,
        type: type || 'note',
        content,
        importance: importance || 5,
        pii: pii || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating memory:', error)
      return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Memories API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

