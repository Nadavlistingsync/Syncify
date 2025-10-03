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
    const timeRange = searchParams.get('timeRange') || '30d'

    // Calculate date range
    const days = parseInt(timeRange.replace('d', ''))
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    // Get analytics data
    const [memoriesResult, conversationsResult, eventsResult, sitePoliciesResult] = await Promise.all([
      supabase
        .from('memories')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', fromDate.toISOString()),
      
      supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', fromDate.toISOString()),
      
      supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('ts', fromDate.toISOString()),
      
      supabase
        .from('site_policies')
        .select('*')
        .eq('user_id', user.id)
        .eq('enabled', true)
    ])

    if (memoriesResult.error) throw memoriesResult.error
    if (conversationsResult.error) throw conversationsResult.error
    if (eventsResult.error) throw eventsResult.error
    if (sitePoliciesResult.error) throw sitePoliciesResult.error

    const memories = memoriesResult.data || []
    const conversations = conversationsResult.data || []
    const events = eventsResult.data || []
    const sitePolicies = sitePoliciesResult.data || []

    // Process analytics
    const analytics = {
      summary: {
        total_memories: memories.length,
        total_conversations: conversations.length,
        total_events: events.length,
        active_sites: sitePolicies.length
      },
      trends: {
        memories_by_day: getTrendData(memories, 'created_at', days),
        conversations_by_day: getTrendData(conversations, 'created_at', days),
        events_by_day: getTrendData(events, 'ts', days)
      },
      top_sites: getTopSites(conversations, events),
      top_providers: getTopProviders(conversations, events),
      memory_breakdown: getMemoryBreakdown(memories),
      sync_health: getSyncHealth(events),
      error_analysis: getErrorAnalysis(events)
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getTrendData(data: any[], dateField: string, days: number) {
  const trends: Record<string, number> = {}
  
  // Initialize all days with 0
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    trends[dateKey] = 0
  }
  
  // Count items per day
  data.forEach(item => {
    const date = new Date(item[dateField]).toISOString().split('T')[0]
    if (trends[date] !== undefined) {
      trends[date]++
    }
  })
  
  return Object.entries(trends).map(([date, count]) => ({
    date,
    count
  }))
}

function getTopSites(conversations: any[], events: any[]) {
  const siteCounts: Record<string, number> = {}
  
  conversations.forEach(conv => {
    const site = getDomainFromUrl(conv.site)
    siteCounts[site] = (siteCounts[site] || 0) + 1
  })
  
  events.forEach(event => {
    const site = getDomainFromUrl(event.payload?.site || '')
    if (site && site !== 'unknown') {
      siteCounts[site] = (siteCounts[site] || 0) + 1
    }
  })
  
  return Object.entries(siteCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([site, count]) => ({ site, count }))
}

function getTopProviders(conversations: any[], events: any[]) {
  const providerCounts: Record<string, number> = {}
  
  conversations.forEach(conv => {
    providerCounts[conv.provider] = (providerCounts[conv.provider] || 0) + 1
  })
  
  events.forEach(event => {
    const provider = event.payload?.provider || 'unknown'
    if (provider !== 'unknown') {
      providerCounts[provider] = (providerCounts[provider] || 0) + 1
    }
  })
  
  return Object.entries(providerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([provider, count]) => ({ provider, count }))
}

function getMemoryBreakdown(memories: any[]) {
  const breakdown: Record<string, number> = {}
  
  memories.forEach(memory => {
    breakdown[memory.type] = (breakdown[memory.type] || 0) + 1
  })
  
  return Object.entries(breakdown)
    .map(([type, count]) => ({ type, count }))
}

function getSyncHealth(events: any[]) {
  const injectEvents = events.filter(e => e.kind === 'inject')
  const errorEvents = events.filter(e => e.kind === 'error')
  const captureEvents = events.filter(e => e.kind === 'capture')
  
  const totalInjects = injectEvents.length
  const successfulInjects = injectEvents.filter(e => e.payload?.success).length
  
  return {
    total_captures: captureEvents.length,
    total_injections: totalInjects,
    successful_injections: successfulInjects,
    failed_injections: totalInjects - successfulInjects,
    total_errors: errorEvents.length,
    success_rate: totalInjects > 0 ? (successfulInjects / totalInjects) * 100 : 0,
    error_rate: events.length > 0 ? (errorEvents.length / events.length) * 100 : 0
  }
}

function getErrorAnalysis(events: any[]) {
  const errorEvents = events.filter(e => e.kind === 'error')
  const errorCounts: Record<string, number> = {}
  const siteErrorCounts: Record<string, Record<string, number>> = {}
  
  errorEvents.forEach(event => {
    const error = event.payload?.error || 'Unknown error'
    const site = getDomainFromUrl(event.payload?.site || '')
    
    // Count errors globally
    errorCounts[error] = (errorCounts[error] || 0) + 1
    
    // Count errors by site
    if (!siteErrorCounts[site]) {
      siteErrorCounts[site] = {}
    }
    siteErrorCounts[site][error] = (siteErrorCounts[site][error] || 0) + 1
  })
  
  const topErrors = Object.entries(errorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([error, count]) => ({ error, count }))
  
  const errorBySite = Object.entries(siteErrorCounts)
    .map(([site, errors]) => ({
      site,
      total_errors: Object.values(errors).reduce((sum, count) => sum + count, 0),
      errors: Object.entries(errors)
        .sort(([,a], [,b]) => b - a)
        .map(([error, count]) => ({ error, count }))
    }))
    .sort((a, b) => b.total_errors - a.total_errors)
    .slice(0, 10)
  
  return {
    top_errors: topErrors,
    errors_by_site: errorBySite,
    total_unique_errors: Object.keys(errorCounts).length
  }
}

function getDomainFromUrl(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
