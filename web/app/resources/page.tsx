'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AuthGuard } from '@/components/auth-guard'
import { SitePolicyCard } from '@/components/site-policy-card'
import { ExportProgressDialog } from '@/components/export-progress-dialog'
import { ChunkedExporter } from '@/lib/chunked-export'
import { 
  Shield, 
  Download, 
  Trash2, 
  Settings, 
  Globe, 
  User, 
  FileText,
  AlertTriangle,
  Eye,
  Plus,
  ExternalLink,
  BookOpen,
  HelpCircle,
  MessageCircle,
  Github,
  Twitter
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getDomainFromUrl } from '@/lib/utils'
import { SitePolicy, Profile } from '@/lib/supabase'
import { useAuth } from '@/app/providers'

export default function ResourcesPage() {
  const [newSiteDomain, setNewSiteDomain] = useState('')
  const [isAddingSite, setIsAddingSite] = useState(false)
  const [exportProgress, setExportProgress] = useState({
    totalChunks: 0,
    completedChunks: 0,
    currentDataType: '',
    currentChunk: 0,
    totalChunksForDataType: 0,
    isDownloading: false
  })
  const [showExportProgress, setShowExportProgress] = useState(false)
  const [chunkedExporter, setChunkedExporter] = useState<ChunkedExporter | null>(null)
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('scope', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) throw error
      return data as Profile[]
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
        .order('origin')
      
      if (error) throw error
      return data
    },
    enabled: !!user
  })

  // Create profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (profile: { name: string; scope: string; token_budget: number }) => {
      if (!user) throw new Error('User not authenticated')
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          ...profile,
          user_id: user.id
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Profile> }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  // Delete profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  // Site policy mutations
  const updateSitePolicyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SitePolicy> }) => {
      const { data, error } = await supabase
        .from('site_policies')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          profiles (
            id,
            name,
            scope
          )
        `)
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-policies'] })
    }
  })

  const deleteSitePolicyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('site_policies')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-policies'] })
    }
  })

  // Add site mutation
  const addSiteMutation = useMutation({
    mutationFn: async (origin: string) => {
      if (!user) throw new Error('User not authenticated')
      const defaultProfile = profiles.find(p => p.scope === 'personal') || profiles[0]
      if (!defaultProfile) throw new Error('No default profile available')
      
      const { data, error } = await supabase
        .from('site_policies')
        .insert({
          origin,
          user_id: user.id,
          profile_id: defaultProfile.id,
          enabled: true,
          capture: true,
          inject: true
        })
        .select(`
          *,
          profiles (
            id,
            name,
            scope
          )
        `)
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-policies'] })
      setNewSiteDomain('')
      setIsAddingSite(false)
    }
  })

  // Simple export function
  const exportData = async (format: 'json' | 'csv' = 'json') => {
    try {
      const params = new URLSearchParams({
        format,
        includeRedacted: 'true'
      })
      
      const response = await fetch(`/api/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `syncify-export-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert(`Data exported successfully as ${format.toUpperCase()}!`)
    } catch (error) {
      console.error('Failed to export data:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  const cancelExport = () => {
    if (chunkedExporter) {
      chunkedExporter.cancel()
      setShowExportProgress(false)
      setChunkedExporter(null)
    }
  }

  // Delete all data function
  const deleteAllData = async () => {
    const confirmed = confirm(
      'Are you sure you want to delete ALL your data? This action cannot be undone.\n\n' +
      'This will delete:\n' +
      '- All memories\n' +
      '- All conversations\n' +
      '- All site policies\n' +
      '- All custom profiles\n' +
      '\nType "DELETE ALL" to confirm:'
    )
    
    if (!confirmed) return
    
    const confirmation = prompt('Type "DELETE ALL" to confirm deletion:')
    if (confirmation !== 'DELETE ALL') {
      alert('Deletion cancelled.')
      return
    }

    try {
      if (!user) throw new Error('User not authenticated')
      
      // Delete in order to respect foreign key constraints
      await Promise.all([
        supabase.from('events').delete().eq('user_id', user.id),
        supabase.from('messages').delete().in('conversation_id', 
          await supabase.from('conversations').select('id').eq('user_id', user.id).then(res => res.data?.map(c => c.id) || [])
        ),
        supabase.from('conversations').delete().eq('user_id', user.id),
        supabase.from('memories').delete().eq('user_id', user.id),
        supabase.from('site_policies').delete().eq('user_id', user.id),
        supabase.from('profiles').delete().eq('user_id', user.id).neq('scope', 'personal').neq('scope', 'work')
      ])
      
      queryClient.invalidateQueries()
      alert('All data has been deleted.')
    } catch (error) {
      console.error('Failed to delete data:', error)
      alert('Failed to delete data. Please try again.')
    }
  }

  return (
    <AuthGuard>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Resources & Help</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Manage your privacy, export your data, and find helpful resources
          </p>
        </div>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Export Your Data</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Download all your memories, conversations, and settings
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Export Format</label>
                  <Select defaultValue="json">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON (Complete)</SelectItem>
                      <SelectItem value="csv">CSV (Summary)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Privacy Level</label>
                  <Select defaultValue="safe">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safe">Safe (Redact sensitive data)</SelectItem>
                      <SelectItem value="full">Full (Include all data)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => exportData('json')} 
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button 
                  onClick={() => exportData('csv')} 
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground text-center">
                <p>💡 Large exports are automatically chunked to prevent timeouts</p>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Privacy Notice</p>
                    <p>
                      The "Safe" export automatically redacts sensitive information like emails, 
                      phone numbers, and API keys. Use "Full" export only if you need complete data 
                      and understand the privacy implications.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-red-600">Delete All Data</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete all your data from Syncify
              </p>
              <Button 
                variant="destructive" 
                onClick={deleteAllData}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Context Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Context Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((profile) => (
                <Card key={profile.id} className="relative">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{profile.name}</h4>
                      <Badge variant="outline">{profile.scope}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Token budget: {profile.token_budget}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Sites: {profile.default_for_sites?.length || 0}</span>
                      {profile.redaction_rules && Object.keys(profile.redaction_rules).length > 0 && (
                        <span className="text-red-600">• Privacy rules active</span>
                      )}
                    </div>
                    {(profile.scope !== 'personal' && profile.scope !== 'work') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteProfileMutation.mutate(profile.id)}
                        className="w-full text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Profile</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  createProfileMutation.mutate({
                    name: formData.get('name') as string,
                    scope: 'custom',
                    token_budget: parseInt(formData.get('token_budget') as string) || 1000
                  })
                }} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Profile Name</label>
                    <Input name="name" placeholder="e.g., Work, Gaming, Research" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Token Budget</label>
                    <Input 
                      name="token_budget" 
                      type="number" 
                      defaultValue="1000" 
                      min="100" 
                      max="5000" 
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={createProfileMutation.isPending}>
                      {createProfileMutation.isPending ? 'Creating...' : 'Create Profile'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Site Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Site Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Manage which sites can capture and inject your context
              </p>
            </div>
            <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Site
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Site</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Domain</label>
                    <Input
                      value={newSiteDomain}
                      onChange={(e) => setNewSiteDomain(e.target.value)}
                      placeholder="example.com"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (newSiteDomain.trim()) {
                            addSiteMutation.mutate(newSiteDomain.trim())
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddingSite(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (newSiteDomain.trim()) {
                          addSiteMutation.mutate(newSiteDomain.trim())
                        }
                      }}
                      disabled={addSiteMutation.isPending || !newSiteDomain.trim()}
                    >
                      {addSiteMutation.isPending ? 'Adding...' : 'Add Site'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {sitePolicies.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sites configured</h3>
              <p className="text-muted-foreground mb-4">
                Add websites where you want to sync your AI context
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sitePolicies.map((policy) => (
                <SitePolicyCard
                  key={policy.id}
                  policy={policy}
                  profiles={profiles}
                  onUpdate={async (id: string, updates: Partial<SitePolicy>) => {
                    await updateSitePolicyMutation.mutateAsync({ id, updates })
                  }}
                  onDelete={async (id: string) => {
                    await deleteSitePolicyMutation.mutateAsync(id)
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Data Collection
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• We only collect data you explicitly provide</li>
                <li>• Conversations are captured only on sites you authorize</li>
                <li>• Private memories are never shared with third-party sites</li>
                <li>• All data is encrypted in transit and at rest</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Your Control
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• You can enable/disable sites individually</li>
                <li>• Choose which profile to use for each site</li>
                <li>• Mark memories as private to prevent sharing</li>
                <li>• Export or delete your data at any time</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Important Privacy Note:</p>
                <p>
                  When you enable context injection on a site, your context profile (including 
                  memories, preferences, and facts) will be automatically shared with that site's 
                  AI system. Only use this feature on sites you trust.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal & Support */}
      <Card>
        <CardHeader>
          <CardTitle>Legal & Support</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Legal</h4>
              <div className="space-y-1">
                <Button variant="link" className="p-0 h-auto text-sm">
                  Privacy Policy
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="link" className="p-0 h-auto text-sm">
                  Terms of Service
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="link" className="p-0 h-auto text-sm">
                  GDPR Compliance
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Support</h4>
              <div className="space-y-1">
                <Button variant="link" className="p-0 h-auto text-sm">
                  Documentation
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="link" className="p-0 h-auto text-sm">
                  Contact Support
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="link" className="p-0 h-auto text-sm">
                  Feature Requests
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Community</h4>
              <div className="space-y-1">
                <Button variant="link" className="p-0 h-auto text-sm">
                  GitHub
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="link" className="p-0 h-auto text-sm">
                  Discord
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="link" className="p-0 h-auto text-sm">
                  Twitter
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
    </AuthGuard>
  )
}

