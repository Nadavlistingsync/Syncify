import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { enabled, profile_id, capture, inject } = body

    const updateData: any = {}
    if (enabled !== undefined) updateData.enabled = enabled
    if (profile_id !== undefined) updateData.profile_id = profile_id
    if (capture !== undefined) updateData.capture = capture
    if (inject !== undefined) updateData.inject = inject

    const { data, error } = await supabase
      .from('site_policies')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select(`
        *,
        profiles (
          id,
          name,
          scope
        )
      `)
      .single()

    if (error) {
      console.error('Error updating site policy:', error)
      return NextResponse.json({ error: 'Failed to update site policy' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Site policy API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('site_policies')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting site policy:', error)
      return NextResponse.json({ error: 'Failed to delete site policy' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Site policy API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

