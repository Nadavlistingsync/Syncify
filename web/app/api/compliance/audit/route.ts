// SOC 2 Type II Audit Logging API
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { AuditLogService, AccessControlService } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions for audit logs
    const hasPermission = await AccessControlService.checkPermission(user.id, 'audit_logs', 'read')
    if (!hasPermission) {
      await AuditLogService.logEvent(
        user.id,
        'unauthorized_access_attempt',
        'audit_logs',
        'denied',
        { 
          requestedBy: user.id,
          timestamp: new Date().toISOString()
        },
        request.ip,
        request.headers.get('user-agent')
      )
      
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const event = searchParams.get('event')
    const severity = searchParams.get('severity')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (event) {
      query = query.eq('event', event)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (startDate) {
      query = query.gte('timestamp', startDate)
    }

    if (endDate) {
      query = query.lte('timestamp', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
    }

    // Log the audit log access
    await AuditLogService.logEvent(
      user.id,
      'audit_log_access',
      'audit_logs',
      'read',
      { 
        filters: { userId, event, severity, startDate, endDate },
        resultCount: data?.length || 0,
        timestamp: new Date().toISOString()
      },
      request.ip,
      request.headers.get('user-agent')
    )

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        limit,
        offset,
        hasMore: (data?.length || 0) === limit
      }
    })
  } catch (error) {
    console.error('Audit API error:', error)
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
    const { event, resource, action, details, severity = 'low' } = body

    if (!event || !resource || !action) {
      return NextResponse.json({ 
        error: 'Event, resource, and action are required' 
      }, { status: 400 })
    }

    // Create audit log entry
    const auditEntry = await AuditLogService.logEvent(
      user.id,
      event,
      resource,
      action,
      details || {},
      request.ip,
      request.headers.get('user-agent')
    )

    // Store in database
    const { data, error: dbError } = await supabase
      .from('audit_logs')
      .insert({
        id: auditEntry.id,
        user_id: user.id,
        event,
        resource,
        action,
        details: JSON.stringify(details || {}),
        severity,
        ip_address: request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error storing audit log:', dbError)
      return NextResponse.json({ error: 'Failed to store audit log' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: auditEntry
    })
  } catch (error) {
    console.error('Audit API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
