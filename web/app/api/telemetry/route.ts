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
    const timeRange = searchParams.get('timeRange') || '7d'
    const groupBy = searchParams.get('groupBy') || 'site'

    // Calculate date range
    const days = parseInt(timeRange.replace('d', ''))
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    // Get telemetry data
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .gte('ts', fromDate.toISOString())
      .order('ts', { ascending: false })

    if (error) {
      console.error('Error fetching telemetry data:', error)
      return NextResponse.json({ error: 'Failed to fetch telemetry data' }, { status: 500 })
    }

    // Process telemetry data
    const telemetryData = processTelemetryData(events || [], groupBy)
    
    return NextResponse.json(telemetryData)
  } catch (error) {
    console.error('Telemetry API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function processTelemetryData(events: any[], groupBy: string) {
  const stats = {
    total_events: events.length,
    by_kind: {},
    by_site: {},
    by_provider: {},
    success_rate: 0,
    error_rate: 0,
    top_errors: [],
    performance: {
      avg_response_time: 0,
      total_injections: 0,
      successful_injections: 0,
      failed_injections: 0
    }
  }

  let totalInjections = 0
  let successfulInjections = 0
  let failedInjections = 0
  let totalResponseTime = 0
  let responseTimeCount = 0
  const errorCounts: Record<string, number> = {}

  events.forEach(event => {
    const payload = event.payload || {}
    const site = payload.site || 'unknown'
    const provider = payload.provider || 'unknown'
    
    // Count by kind
    stats.by_kind[event.kind] = (stats.by_kind[event.kind] || 0) + 1
    
    // Count by site
    stats.by_site[site] = (stats.by_site[site] || 0) + 1
    
    // Count by provider
    stats.by_provider[provider] = (stats.by_provider[provider] || 0) + 1
    
    // Track injection performance
    if (event.kind === 'inject') {
      totalInjections++
      if (payload.success) {
        successfulInjections++
      } else {
        failedInjections++
      }
      
      if (payload.response_time) {
        totalResponseTime += payload.response_time
        responseTimeCount++
      }
    }
    
    // Track errors
    if (event.kind === 'error') {
      const errorMsg = payload.error || 'Unknown error'
      errorCounts[errorMsg] = (errorCounts[errorMsg] || 0) + 1
    }
  })

  // Calculate rates
  const totalInjectionEvents = totalInjections
  stats.success_rate = totalInjectionEvents > 0 ? (successfulInjections / totalInjectionEvents) * 100 : 0
  stats.error_rate = events.length > 0 ? (stats.by_kind.error || 0) / events.length * 100 : 0

  // Performance metrics
  stats.performance.total_injections = totalInjections
  stats.performance.successful_injections = successfulInjections
  stats.performance.failed_injections = failedInjections
  stats.performance.avg_response_time = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0

  // Top errors
  stats.top_errors = Object.entries(errorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([error, count]) => ({ error, count }))

  return stats
}
