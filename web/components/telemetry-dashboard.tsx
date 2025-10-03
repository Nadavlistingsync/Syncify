'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  BarChart3,
  RefreshCw,
  Zap
} from 'lucide-react'
import { formatRelativeTime, getDomainFromUrl } from '@/lib/utils'

interface TelemetryDashboardProps {
  timeRange?: string
}

export function TelemetryDashboard({ timeRange = '7d' }: TelemetryDashboardProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange)

  // Fetch telemetry data
  const { data: telemetryData, isLoading: telemetryLoading, refetch: refetchTelemetry } = useQuery({
    queryKey: ['telemetry', selectedTimeRange],
    queryFn: async () => {
      const response = await fetch(`/api/telemetry?timeRange=${selectedTimeRange}`)
      if (!response.ok) throw new Error('Failed to fetch telemetry data')
      return response.json()
    }
  })

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics', selectedTimeRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?timeRange=${selectedTimeRange}`)
      if (!response.ok) throw new Error('Failed to fetch analytics data')
      return response.json()
    }
  })

  const handleRefresh = () => {
    refetchTelemetry()
    refetchAnalytics()
  }

  const isLoading = telemetryLoading || analyticsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Telemetry & Analytics</h2>
          <div className="flex items-center gap-2">
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Telemetry & Analytics</h2>
        <div className="flex items-center gap-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{telemetryData?.total_events || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{Math.round(telemetryData?.success_rate || 0)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">{Math.round(telemetryData?.error_rate || 0)}%</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">
                  {telemetryData?.performance?.avg_response_time 
                    ? `${Math.round(telemetryData.performance.avg_response_time)}ms`
                    : '-'
                  }
                </p>
              </div>
              <Zap className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Summary */}
      {analyticsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Memories</p>
                  <p className="text-2xl font-bold">{analyticsData.summary?.total_memories || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conversations</p>
                  <p className="text-2xl font-bold">{analyticsData.summary?.total_conversations || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sync Events</p>
                  <p className="text-2xl font-bold">{analyticsData.summary?.total_events || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Sites</p>
                  <p className="text-2xl font-bold">{analyticsData.summary?.active_sites || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Events by Kind */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Events by Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(telemetryData?.by_kind || {}).map(([kind, count]) => (
              <div key={kind} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  {kind === 'capture' && <CheckCircle className="h-4 w-4 text-blue-600" />}
                  {kind === 'inject' && <Zap className="h-4 w-4 text-green-600" />}
                  {kind === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                  <span className="font-medium capitalize">{kind}</span>
                </div>
                <Badge variant="outline">{count as number}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Sites */}
      <Card>
        <CardHeader>
          <CardTitle>Top Sites</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {telemetryData?.by_site && Object.entries(telemetryData.by_site)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .slice(0, 10)
              .map(([site, count]) => (
                <div key={site} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-sm font-medium">{getDomainFromUrl(site)}</span>
                  </div>
                  <Badge variant="outline">{count as number}</Badge>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>

      {/* Top Errors */}
      {telemetryData?.top_errors && telemetryData.top_errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Top Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {telemetryData.top_errors.map((error: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-800 truncate">
                      {error.error}
                    </p>
                  </div>
                  <Badge variant="destructive">{error.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Health */}
      {analyticsData?.sync_health && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {analyticsData.sync_health.successful_injections}
                </p>
                <p className="text-sm text-muted-foreground">Successful Injects</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {analyticsData.sync_health.failed_injections}
                </p>
                <p className="text-sm text-muted-foreground">Failed Injects</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {analyticsData.sync_health.total_captures}
                </p>
                <p className="text-sm text-muted-foreground">Total Captures</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {Math.round(analyticsData.sync_health.success_rate || 0)}%
                </p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
