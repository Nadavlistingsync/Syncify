'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Globe, 
  Brain,
  BarChart3,
  Settings,
  RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRelativeTime, getDomainFromUrl } from '@/lib/utils'
import { TelemetryDashboard } from '@/components/telemetry-dashboard'
import { AuthGuard } from '@/components/auth-guard'
import { useAuth } from '@/app/providers'

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState('7d')
  const supabase = createClient()
  const { user } = useAuth()

  // Fetch events for telemetry
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events', timeRange],
    queryFn: async () => {
      if (!user) return []
      const days = parseInt(timeRange.replace('d', ''))
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('ts', fromDate.toISOString())
        .order('ts', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!user
  })

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', timeRange],
    queryFn: async () => {
      if (!user) return []
      const days = parseInt(timeRange.replace('d', ''))
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)
      
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!user
  })

  // Fetch site policies
  const { data: sitePolicies = [] } = useQuery({
    queryKey: ['site-policies'],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
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
        .eq('enabled', true)
        .order('origin')
      
      if (error) throw error
      return data
    },
    enabled: !!user
  })

  // Calculate stats
  const totalEvents = events.length
  const successfulInjects = events.filter(e => e.kind === 'inject').length
  const failedInjects = events.filter(e => e.kind === 'error').length
  const captureEvents = events.filter(e => e.kind === 'capture').length
  
  const successRate = successfulInjects > 0 
    ? Math.round((successfulInjects / (successfulInjects + failedInjects)) * 100)
    : 0

  // Get top sites
  const siteStats = conversations.reduce((acc, conv) => {
    const domain = getDomainFromUrl(conv.site)
    acc[domain] = (acc[domain] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topSites = Object.entries(siteStats)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)

  // Get top providers
  const providerStats = conversations.reduce((acc, conv) => {
    acc[conv.provider] = (acc[conv.provider] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topProviders = Object.entries(providerStats)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)

  // Recent activity
  const recentActivity = events.slice(0, 10)

  return (
    <AuthGuard>
      <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor your AI context synchronization activity and performance
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
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
          
          <Button variant="outline" size="sm">
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
                <p className="text-2xl font-bold">{totalEvents}</p>
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
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Context Captures</p>
                <p className="text-2xl font-bold">{captureEvents}</p>
              </div>
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Sites</p>
                <p className="text-2xl font-bold">{sitePolicies.length}</p>
              </div>
              <Globe className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Top Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSites.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No activity in the selected time range
              </p>
            ) : (
              <div className="space-y-3">
                {topSites.map(([site, count]) => (
                  <div key={site} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="text-sm font-medium">{site}</span>
                    </div>
                    <Badge variant="outline">{count as number} conversations</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Providers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Top AI Providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProviders.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No activity in the selected time range
              </p>
            ) : (
              <div className="space-y-3">
                {topProviders.map(([provider, count]) => (
                  <div key={provider} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="text-sm font-medium capitalize">{provider}</span>
                    </div>
                    <Badge variant="outline">{count as number} conversations</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-3 h-3 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-muted rounded w-1/3"></div>
                    <div className="h-2 bg-muted rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No recent activity
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((event) => (
                <div key={event.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {event.kind === 'inject' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : event.kind === 'capture' ? (
                      <Brain className="h-4 w-4 text-blue-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {event.kind === 'inject' && 'Context injected'}
                      {event.kind === 'capture' && 'Context captured'}
                      {event.kind === 'error' && 'Error occurred'}
                      {event.payload?.site && (
                        <span className="text-muted-foreground ml-1">
                          on {getDomainFromUrl(event.payload.site)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(event.ts)}
                    </p>
                  </div>
                  <Badge 
                    variant={event.kind === 'error' ? 'destructive' : 'outline'}
                    className="text-xs"
                  >
                    {event.kind}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site Policies Quick View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Active Site Policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sitePolicies.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No active sites</h3>
              <p className="text-muted-foreground mb-4">
                Install the Chrome extension and visit AI websites to start syncing
              </p>
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Manage Settings
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sitePolicies.map((policy) => (
                <div key={policy.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {getDomainFromUrl(policy.origin)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {policy.profiles?.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className={policy.capture ? 'text-green-600' : 'text-gray-400'}>
                      Capture {policy.capture ? '✓' : '✗'}
                    </span>
                    <span className={policy.inject ? 'text-green-600' : 'text-gray-400'}>
                      Inject {policy.inject ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telemetry Dashboard */}
      <TelemetryDashboard timeRange={timeRange} />
      </div>
    </AuthGuard>
  )
}

