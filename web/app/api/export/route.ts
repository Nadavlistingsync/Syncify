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
    const format = searchParams.get('format') || 'json'
    const includeRedacted = searchParams.get('includeRedacted') === 'true'

    // Fetch all user data
    const [memoriesResult, conversationsResult, profilesResult, sitePoliciesResult, eventsResult] = await Promise.all([
      supabase
        .from('memories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      
      supabase
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
        .order('created_at', { ascending: false }),
      
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      
      supabase
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
        .order('created_at', { ascending: false }),
      
      supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('ts', { ascending: false })
        .limit(1000) // Limit events to prevent huge exports
    ])

    if (memoriesResult.error) throw memoriesResult.error
    if (conversationsResult.error) throw conversationsResult.error
    if (profilesResult.error) throw profilesResult.error
    if (sitePoliciesResult.error) throw sitePoliciesResult.error
    if (eventsResult.error) throw eventsResult.error

    // Process data
    let processedMemories = memoriesResult.data || []
    
    // Redact sensitive information if not including redacted data
    if (!includeRedacted) {
      const { redactMemoryContent } = await import('@/lib/redaction')
      processedMemories = processedMemories.map(memory => ({
        ...memory,
        content: redactMemoryContent(memory.content, memory.pii)
      }))
    }

    // Create export data
    const exportData = {
      export_info: {
        export_date: new Date().toISOString(),
        user_id: user.id,
        format: format,
        version: '1.0.0',
        include_redacted: includeRedacted,
        total_memories: processedMemories.length,
        total_conversations: (conversationsResult.data || []).length,
        total_profiles: (profilesResult.data || []).length,
        total_sites: (sitePoliciesResult.data || []).length,
        total_events: (eventsResult.data || []).length
      },
      data: {
        memories: processedMemories,
        conversations: conversationsResult.data || [],
        profiles: profilesResult.data || [],
        site_policies: sitePoliciesResult.data || [],
        events: eventsResult.data || []
      }
    }

    // Return appropriate format
    if (format === 'json') {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="syncify-export-${new Date().toISOString().split('T')[0]}.json"`
        }
      })
    } else if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(exportData)
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="syncify-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else {
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }

  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function convertToCSV(exportData: any): string {
  const csvLines: string[] = []
  
  // Add export info
  csvLines.push('Export Information')
  csvLines.push('Key,Value')
  Object.entries(exportData.export_info).forEach(([key, value]) => {
    csvLines.push(`${key},"${value}"`)
  })
  
  csvLines.push('') // Empty line
  
  // Add memories
  if (exportData.data.memories.length > 0) {
    csvLines.push('Memories')
    csvLines.push('ID,Type,Content,Importance,PII,Created At')
    exportData.data.memories.forEach((memory: any) => {
      const content = memory.content.replace(/"/g, '""') // Escape quotes
      csvLines.push(`${memory.id},"${memory.type}","${content}",${memory.importance},"${memory.pii}","${memory.created_at}"`)
    })
    csvLines.push('') // Empty line
  }
  
  // Add conversations
  if (exportData.data.conversations.length > 0) {
    csvLines.push('Conversations')
    csvLines.push('ID,Title,Provider,Site,Created At')
    exportData.data.conversations.forEach((conversation: any) => {
      const title = conversation.title.replace(/"/g, '""') // Escape quotes
      csvLines.push(`${conversation.id},"${title}","${conversation.provider}","${conversation.site}","${conversation.created_at}"`)
    })
    csvLines.push('') // Empty line
  }
  
  // Add profiles
  if (exportData.data.profiles.length > 0) {
    csvLines.push('Profiles')
    csvLines.push('ID,Name,Scope,Token Budget,Created At')
    exportData.data.profiles.forEach((profile: any) => {
      csvLines.push(`${profile.id},"${profile.name}","${profile.scope}",${profile.token_budget},"${profile.created_at}"`)
    })
    csvLines.push('') // Empty line
  }
  
  // Add site policies
  if (exportData.data.site_policies.length > 0) {
    csvLines.push('Site Policies')
    csvLines.push('ID,Origin,Enabled,Capture,Inject,Created At')
    exportData.data.site_policies.forEach((policy: any) => {
      csvLines.push(`${policy.id},"${policy.origin}","${policy.enabled}","${policy.capture}","${policy.inject}","${policy.created_at}"`)
    })
  }
  
  return csvLines.join('\n')
}
