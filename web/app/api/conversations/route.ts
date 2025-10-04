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
    const provider = searchParams.get('provider')
    const site = searchParams.get('site')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('conversations')
      .select(`
        *,
        messages (
          id,
          role,
          content,
          ts,
          provider
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (provider) {
      query = query.eq('provider', provider)
    }

    if (site) {
      query = query.eq('site', site)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Conversations API error:', error)
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
    const { title, provider, site, messages } = body

    if (!title || !provider || !site) {
      return NextResponse.json({ error: 'Title, provider, and site required' }, { status: 400 })
    }

    // Insert conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title,
        provider,
        site
      })
      .select()
      .single()

    if (conversationError) {
      console.error('Error creating conversation:', conversationError)
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    // Insert messages if provided
    if (messages && messages.length > 0) {
      const messagesData = messages.map((msg: any) => ({
        conversation_id: conversation.id,
        role: msg.role,
        content: msg.content,
        provider: provider,
        ts: msg.timestamp || new Date().toISOString()
      }))

      const { error: messagesError } = await supabase
        .from('messages')
        .insert(messagesData)

      if (messagesError) {
        console.error('Error inserting messages:', messagesError)
        // Don't fail the request, just log the error
      } else {
        // Extract and store context from the conversation
        try {
          await supabase.rpc('extract_context_from_conversation', {
            p_conversation_id: conversation.id,
            p_user_id: user.id,
            p_site: site,
            p_provider: provider
          })
        } catch (contextError) {
          console.error('Error extracting context:', contextError)
          // Don't fail the request, just log the error
        }
      }
    }

    return NextResponse.json(conversation)
  } catch (error) {
    console.error('Conversations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

