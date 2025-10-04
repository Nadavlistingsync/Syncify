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
    const site = searchParams.get('site')
    const provider = searchParams.get('provider')
    const contextType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('user_context')
      .select(`
        *,
        conversations (
          id,
          title,
          provider,
          site
        )
      `)
      .eq('user_id', user.id)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (site) {
      query = query.eq('site', site)
    }

    if (provider) {
      query = query.eq('provider', provider)
    }

    if (contextType) {
      query = query.eq('context_type', contextType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching user context:', error)
      return NextResponse.json({ error: 'Failed to fetch user context' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('User context API error:', error)
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
    const { 
      conversation_id, 
      site, 
      provider, 
      context_type = 'conversation', 
      title, 
      content, 
      importance = 5, 
      pii = false, 
      metadata = {} 
    } = body

    if (!site || !provider || !title || !content) {
      return NextResponse.json({ error: 'Site, provider, title, and content required' }, { status: 400 })
    }

    // Use the database function to store context
    const { data, error } = await supabase.rpc('store_user_context', {
      p_user_id: user.id,
      p_conversation_id: conversation_id,
      p_site: site,
      p_provider: provider,
      p_title: title,
      p_content: content,
      p_context_type: context_type,
      p_importance: importance,
      p_pii: pii,
      p_metadata: metadata
    })

    if (error) {
      console.error('Error storing user context:', error)
      return NextResponse.json({ error: 'Failed to store user context' }, { status: 500 })
    }

    return NextResponse.json({ id: data })
  } catch (error) {
    console.error('User context API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
