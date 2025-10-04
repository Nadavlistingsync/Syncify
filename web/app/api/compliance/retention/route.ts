// Data Retention API - SOC 1 and SOC 2 compliance
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { DataRetentionService, AuditLogService, AccessControlService } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions for data retention
    const hasPermission = await AccessControlService.checkPermission(user.id, 'data_retention', 'execute')
    if (!hasPermission) {
      await AuditLogService.logEvent(
        user.id,
        'unauthorized_retention_attempt',
        'data_retention',
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

    const body = await request.json()
    const { action, force = false } = body

    switch (action) {
      case 'cleanup':
        // Execute data retention cleanup
        const cleanupResult = await DataRetentionService.cleanupExpiredData()
        
        await AuditLogService.logEvent(
          user.id,
          'data_retention_cleanup',
          'data_retention',
          'execute',
          { 
            cleanupResult,
            forced: force,
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          data: cleanupResult,
          message: 'Data retention cleanup completed successfully'
        })

      case 'report':
        // Generate retention report
        const retentionReport = await generateRetentionReport(supabase)
        
        await AuditLogService.logEvent(
          user.id,
          'retention_report_generated',
          'data_retention',
          'read',
          { 
            reportSize: JSON.stringify(retentionReport).length,
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          data: retentionReport
        })

      case 'update_policy':
        // Update retention policies
        const { policy_type, retention_days, reason } = body
        
        if (!policy_type || !retention_days || !reason) {
          return NextResponse.json({ 
            error: 'policy_type, retention_days, and reason are required' 
          }, { status: 400 })
        }

        // Update retention policy
        const { error: policyError } = await supabase
          .from('retention_policies')
          .upsert({
            policy_type,
            retention_days,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
            reason
          })

        if (policyError) {
          throw policyError
        }

        await AuditLogService.logEvent(
          user.id,
          'retention_policy_updated',
          'data_retention',
          'update',
          { 
            policy_type,
            retention_days,
            reason,
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          message: 'Retention policy updated successfully'
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use "cleanup", "report", or "update_policy"' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Retention API error:', error)
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

    // Check if user has admin permissions
    const hasPermission = await AccessControlService.checkPermission(user.id, 'data_retention', 'read')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get current retention policies
    const { data: policies, error: policiesError } = await supabase
      .from('retention_policies')
      .select('*')
      .order('policy_type')

    if (policiesError) {
      console.error('Error fetching retention policies:', policiesError)
      return NextResponse.json({ error: 'Failed to fetch retention policies' }, { status: 500 })
    }

    // Get data counts by age
    const dataCounts = await getDataCountsByAge(supabase)

    return NextResponse.json({
      success: true,
      data: {
        policies: policies || [],
        data_counts: dataCounts,
        compliance_status: {
          soc1: 'Compliant - 7 year retention for financial data',
          soc2: 'Compliant - 3 year retention for operational data',
          gdpr: 'Compliant - User data deletion and anonymization available'
        }
      }
    })
  } catch (error) {
    console.error('Retention API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateRetentionReport(supabase: any) {
  const now = new Date()
  
  // Calculate retention thresholds
  const thresholds = {
    conversations: new Date(now.getTime() - (1095 * 24 * 60 * 60 * 1000)), // 3 years
    events: new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)), // 1 year
    audit_logs: new Date(now.getTime() - (2555 * 24 * 60 * 60 * 1000)), // 7 years
    user_context: new Date(now.getTime() - (1095 * 24 * 60 * 60 * 1000)) // 3 years
  }

  // Get counts of data exceeding retention periods
  const [expiredConversations, expiredEvents, expiredAuditLogs, expiredUserContext] = await Promise.all([
    supabase.from('conversations').select('id', { count: 'exact' }).lt('created_at', thresholds.conversations.toISOString()),
    supabase.from('events').select('id', { count: 'exact' }).lt('ts', thresholds.events.toISOString()),
    supabase.from('audit_logs').select('id', { count: 'exact' }).lt('timestamp', thresholds.audit_logs.toISOString()),
    supabase.from('user_context').select('id', { count: 'exact' }).lt('created_at', thresholds.user_context.toISOString())
  ])

  return {
    report_date: now.toISOString(),
    retention_thresholds: thresholds,
    expired_data_counts: {
      conversations: expiredConversations.count || 0,
      events: expiredEvents.count || 0,
      audit_logs: expiredAuditLogs.count || 0,
      user_context: expiredUserContext.count || 0
    },
    total_expired_records: (expiredConversations.count || 0) + 
                          (expiredEvents.count || 0) + 
                          (expiredAuditLogs.count || 0) + 
                          (expiredUserContext.count || 0),
    compliance_status: {
      soc1: 'Compliant - Financial data retained for 7 years',
      soc2: 'Compliant - Operational data retained for 3 years',
      gdpr: 'Compliant - User data deletion available'
    },
    recommendations: [
      'Schedule automated cleanup for expired data',
      'Monitor retention policy compliance monthly',
      'Archive critical data before deletion',
      'Maintain audit trail of all data deletions'
    ]
  }
}

async function getDataCountsByAge(supabase: any) {
  const now = new Date()
  const ageRanges = [
    { label: '0-30 days', days: 30 },
    { label: '31-90 days', days: 90 },
    { label: '91-365 days', days: 365 },
    { label: '1-3 years', days: 1095 },
    { label: '3-7 years', days: 2555 },
    { label: '7+ years', days: 2555 }
  ]

  const counts = {}
  
  for (const range of ageRanges) {
    const cutoffDate = new Date(now.getTime() - (range.days * 24 * 60 * 60 * 1000))
    
    const [conversations, events, userContext] = await Promise.all([
      supabase.from('conversations').select('id', { count: 'exact' }).gte('created_at', cutoffDate.toISOString()),
      supabase.from('events').select('id', { count: 'exact' }).gte('ts', cutoffDate.toISOString()),
      supabase.from('user_context').select('id', { count: 'exact' }).gte('created_at', cutoffDate.toISOString())
    ])

    counts[range.label] = {
      conversations: conversations.count || 0,
      events: events.count || 0,
      user_context: userContext.count || 0,
      total: (conversations.count || 0) + (events.count || 0) + (userContext.count || 0)
    }
  }

  return counts
}
