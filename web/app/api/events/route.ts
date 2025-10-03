import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { kind, payload, site, provider } = body

    if (!kind || !payload) {
      return NextResponse.json({ error: 'Kind and payload required' }, { status: 400 })
    }

    // Insert event
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        kind,
        payload: {
          ...payload,
          site,
          provider,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting event:', error)
      return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Events API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('ts', { ascending: false })
      .range(offset, offset + limit - 1)

    if (kind) {
      query = query.eq('kind', kind)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching events:', error)
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Events API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

