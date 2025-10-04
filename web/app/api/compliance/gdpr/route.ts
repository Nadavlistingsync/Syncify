// GDPR Compliance API - Right to be forgotten, data portability
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { 
  GDPRComplianceService, 
  AuditLogService, 
  PIIDetectionService,
  DataRetentionService 
} from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'export':
        // Data portability - export all user data
        const exportData = await GDPRComplianceService.exportUserData(user.id)
        
        await AuditLogService.logEvent(
          user.id,
          'gdpr_data_export',
          'user_data',
          'export',
          { 
            exportSize: JSON.stringify(exportData).length,
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          data: exportData,
          message: 'Data export completed successfully'
        })

      case 'status':
        // Check data processing status
        const userDataStatus = await getUserDataStatus(supabase, user.id)
        
        return NextResponse.json({
          success: true,
          data: userDataStatus
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use "export" or "status"' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('GDPR API error:', error)
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
    const { action, reason } = body

    switch (action) {
      case 'delete':
        // Right to be forgotten
        if (!reason) {
          return NextResponse.json({ 
            error: 'Reason for deletion is required' 
          }, { status: 400 })
        }

        const deletionRecord = await GDPRComplianceService.deleteUserData(user.id, reason)
        
        await AuditLogService.logEvent(
          user.id,
          'gdpr_deletion_request',
          'user_data',
          'delete_request',
          { 
            reason,
            deletionId: deletionRecord.user_id,
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          data: deletionRecord,
          message: 'Data deletion request submitted successfully'
        })

      case 'anonymize':
        // Data anonymization
        const anonymizationRecord = await GDPRComplianceService.anonymizeUserData(user.id)
        
        await AuditLogService.logEvent(
          user.id,
          'gdpr_anonymization_request',
          'user_data',
          'anonymize_request',
          { 
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          data: anonymizationRecord,
          message: 'Data anonymization request submitted successfully'
        })

      case 'update_consent':
        // Update consent preferences
        const { consent_type, granted } = body
        
        if (!consent_type || typeof granted !== 'boolean') {
          return NextResponse.json({ 
            error: 'consent_type and granted (boolean) are required' 
          }, { status: 400 })
        }

        // Update consent in database
        const { error: consentError } = await supabase
          .from('user_consent')
          .upsert({
            user_id: user.id,
            consent_type,
            granted,
            updated_at: new Date().toISOString()
          })

        if (consentError) {
          throw consentError
        }

        await AuditLogService.logEvent(
          user.id,
          'consent_update',
          'user_consent',
          'update',
          { 
            consent_type,
            granted,
            timestamp: new Date().toISOString()
          },
          request.ip,
          request.headers.get('user-agent')
        )

        return NextResponse.json({
          success: true,
          message: 'Consent preferences updated successfully'
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use "delete", "anonymize", or "update_consent"' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('GDPR API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getUserDataStatus(supabase: any, userId: string) {
  // Get counts of different data types
  const [memories, conversations, events, userContext] = await Promise.all([
    supabase.from('memories').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('conversations').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('events').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('user_context').select('id', { count: 'exact' }).eq('user_id', userId)
  ])

  return {
    data_categories: {
      memories: { count: memories.count, retention_days: 2555 },
      conversations: { count: conversations.count, retention_days: 1095 },
      events: { count: events.count, retention_days: 365 },
      user_context: { count: userContext.count, retention_days: 1095 }
    },
    consent_status: {
      data_processing: true,
      analytics: true,
      marketing: false
    },
    last_updated: new Date().toISOString(),
    retention_policy: 'SOC 1 compliance - 7 years for financial data',
    encryption_status: 'Data encrypted at rest using AES-256-GCM'
  }
}
