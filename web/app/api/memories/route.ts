import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { AuditLogService, PIIDetectionService, InputValidationService } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('memories')
      .select('*')
      .eq('user_id', user.id)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching memories:', error)
      return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
    }

    // Log memory access for audit trail
    await AuditLogService.logEvent(
      user.id,
      'memory_access',
      'memories',
      'read',
      { 
        count: data?.length || 0,
        filters: { type, limit, offset },
        timestamp: new Date().toISOString()
      },
      request.ip || undefined,
      request.headers.get('user-agent') || undefined
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('Memories API error:', error)
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
    const { type, content, importance, pii } = body

    if (!content) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 })
    }

    // Validate and sanitize input
    const sanitizedContent = InputValidationService.sanitizeInput(content)
    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 })
    }

    // Detect PII in content
    const piiDetection = PIIDetectionService.detectPII(sanitizedContent)
    
    if (piiDetection.hasPII && !pii) {
      // Log PII detection
      await AuditLogService.logEvent(
        user.id,
        'pii_detected',
        'memories',
        'create',
        { 
          pii_types: piiDetection.piiTypes,
          content_preview: sanitizedContent.substring(0, 100),
          timestamp: new Date().toISOString()
        },
        request.ip,
        request.headers.get('user-agent')
      )

      return NextResponse.json({ 
        error: 'PII detected in content. Please mark as PII if this is intentional.',
        pii_types: piiDetection.piiTypes
      }, { status: 400 })
    }

    // Insert memory
    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: user.id,
        type: type || 'note',
        content: piiDetection.hasPII ? piiDetection.redactedText : sanitizedContent,
        importance: importance || 5,
        pii: pii || piiDetection.hasPII
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating memory:', error)
      return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 })
    }

    // Log memory creation for audit trail
    await AuditLogService.logEvent(
      user.id,
      'memory_created',
      'memories',
      'create',
      { 
        memory_id: data.id,
        type: data.type,
        has_pii: data.pii,
        importance: data.importance,
        pii_types: piiDetection.piiTypes,
        timestamp: new Date().toISOString()
      },
      request.ip || undefined,
      request.headers.get('user-agent') || undefined
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('Memories API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

