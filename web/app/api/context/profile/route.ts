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

    if (!site) {
      return NextResponse.json({ error: 'Site parameter required' }, { status: 400 })
    }

    // Get context profile using the database function
    const { data, error } = await supabase.rpc('get_context_profile', {
      p_user_id: user.id,
      p_site: site,
      p_provider: provider
    })

    if (error) {
      console.error('Error getting context profile:', error)
      return NextResponse.json({ error: 'Failed to get context profile' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Context profile API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

