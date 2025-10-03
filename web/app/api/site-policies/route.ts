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
    const origin = searchParams.get('origin')

    let query = supabase
      .from('site_policies')
      .select(`
        *,
        profiles (
          id,
          name,
          scope
        )
      `)
      .eq('user_id', user.id)
      .order('origin')

    if (origin) {
      query = query.eq('origin', origin)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching site policies:', error)
      return NextResponse.json({ error: 'Failed to fetch site policies' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Site policies API error:', error)
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
    const { origin, profile_id, enabled, capture, inject } = body

    if (!origin || !profile_id) {
      return NextResponse.json({ error: 'Origin and profile_id required' }, { status: 400 })
    }

    // Use get_or_create_site_policy function
    const { data: policyId, error } = await supabase.rpc('get_or_create_site_policy', {
      p_user_id: user.id,
      p_origin: origin,
      p_profile_id: profile_id
    })

    if (error) {
      console.error('Error creating site policy:', error)
      return NextResponse.json({ error: 'Failed to create site policy' }, { status: 500 })
    }

    // Update the policy with additional settings
    const { data, error: updateError } = await supabase
      .from('site_policies')
      .update({
        enabled: enabled !== undefined ? enabled : true,
        capture: capture !== undefined ? capture : true,
        inject: inject !== undefined ? inject : true
      })
      .eq('id', policyId)
      .select(`
        *,
        profiles (
          id,
          name,
          scope
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating site policy:', updateError)
      return NextResponse.json({ error: 'Failed to update site policy' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Site policies API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

