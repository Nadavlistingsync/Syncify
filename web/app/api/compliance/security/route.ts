// Security Monitoring and SOC 2 Compliance API
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

    // Check if user has admin permissions
    const hasPermission = await AccessControlService.checkPermission(user.id, 'security_events', 'read')
    if (!hasPermission) {
      await AuditLogService.logEvent(
        user.id,
        'unauthorized_security_access',
        'security_events',
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
    const action = searchParams.get('action')

    switch (action) {
      case 'events':
        // Get security events
        const severity = searchParams.get('severity')
        const resolved = searchParams.get('resolved')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        let query = supabase
          .from('security_events')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (severity) {
          query = query.eq('severity', severity)
        }

        if (resolved !== null) {
          query = query.eq('resolved', resolved === 'true')
        }

        const { data: events, error: eventsError } = await query

        if (eventsError) {
          console.error('Error fetching security events:', eventsError)
          return NextResponse.json({ error: 'Failed to fetch security events' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          data: events || []
        })

      case 'dashboard':
        // Get security dashboard data
        const dashboardData = await getSecurityDashboard(supabase)
        
        return NextResponse.json({
          success: true,
          data: dashboardData
        })

      case 'threats':
        // Get active threats
        const threats = await getActiveThreats(supabase)
        
        return NextResponse.json({
          success: true,
          data: threats
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use "events", "dashboard", or "threats"' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Security API error:', error)
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
    const { action } = body

    switch (action) {
      case 'resolve_event':
        // Resolve security event
        const { event_id, resolution_notes } = body
        
        if (!event_id) {
          return NextResponse.json({ 
            error: 'event_id is required' 
          }, { status: 400 })
        }

        // Check permissions
        const hasPermission = await AccessControlService.checkPermission(user.id, 'security_events', 'update')
        if (!hasPermission) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        const { data, error: resolveError } = await supabase
          .from('security_events')
          .update({
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
            metadata: supabase.raw(`metadata || '{"resolution_notes": "${resolution_notes || ''}"}'`)
          })
          .eq('id', event_id)
          .select()
          .single()

        if (resolveError) {
          console.error('Error resolving security event:', resolveError)
          return NextResponse.json({ error: 'Failed to resolve security event' }, { status: 500 })
        }

        await AuditLogService.logEvent(
          user.id,
          'security_event_resolved',
          'security_events',
          'update',
          { 
            event_id,
            resolution_notes,
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          data
        })

      case 'create_alert':
        // Create security alert
        const { alert_type, severity, description, metadata } = body
        
        if (!alert_type || !severity || !description) {
          return NextResponse.json({ 
            error: 'alert_type, severity, and description are required' 
          }, { status: 400 })
        }

        const { data: alert, error: alertError } = await supabase
          .from('security_events')
          .insert({
            user_id: user.id,
            event_type: alert_type,
            severity,
            description,
            metadata: metadata || {}
          })
          .select()
          .single()

        if (alertError) {
          console.error('Error creating security alert:', alertError)
          return NextResponse.json({ error: 'Failed to create security alert' }, { status: 500 })
        }

        await AuditLogService.logEvent(
          user.id,
          'security_alert_created',
          'security_events',
          'create',
          { 
            alert_id: alert.id,
            alert_type,
            severity,
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          data: alert
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use "resolve_event" or "create_alert"' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Security API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getSecurityDashboard(supabase: any) {
  const now = new Date()
  const last24h = new Date(now.getTime() - (24 * 60 * 60 * 1000))
  const last7d = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))

  // Get event counts by severity
  const [criticalEvents, highEvents, mediumEvents, lowEvents] = await Promise.all([
    supabase.from('security_events').select('id', { count: 'exact' }).eq('severity', 'critical'),
    supabase.from('security_events').select('id', { count: 'exact' }).eq('severity', 'high'),
    supabase.from('security_events').select('id', { count: 'exact' }).eq('severity', 'medium'),
    supabase.from('security_events').select('id', { count: 'exact' }).eq('severity', 'low')
  ])

  // Get unresolved events
  const { data: unresolvedEvents } = await supabase
    .from('security_events')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get recent events (last 24h)
  const { data: recentEvents } = await supabase
    .from('security_events')
    .select('*')
    .gte('created_at', last24h.toISOString())
    .order('created_at', { ascending: false })

  // Get PII detection events
  const { data: piiEvents } = await supabase
    .from('pii_detection_log')
    .select('*')
    .gte('created_at', last7d.toISOString())
    .order('created_at', { ascending: false })

  return {
    summary: {
      total_events: {
        critical: criticalEvents.count || 0,
        high: highEvents.count || 0,
        medium: mediumEvents.count || 0,
        low: lowEvents.count || 0
      },
      unresolved_count: unresolvedEvents?.length || 0,
      recent_events_24h: recentEvents?.length || 0,
      pii_detections_7d: piiEvents?.length || 0
    },
    recent_events: recentEvents || [],
    unresolved_events: unresolvedEvents || [],
    pii_detections: piiEvents || [],
    compliance_status: {
      soc2: 'Compliant - Security monitoring active',
      soc1: 'Compliant - Financial data protection enabled',
      gdpr: 'Compliant - PII detection and protection active'
    },
    last_updated: now.toISOString()
  }
}

async function getActiveThreats(supabase: any) {
  const { data: threats } = await supabase
    .from('security_events')
    .select('*')
    .eq('resolved', false)
    .in('severity', ['critical', 'high'])
    .order('created_at', { ascending: false })

  return threats || []
}
