'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Globe, Settings, Trash2, Edit2 } from 'lucide-react'
import { getDomainFromUrl } from '@/lib/utils'
import { SitePolicy } from '@/lib/supabase'

interface SitePolicyCardProps {
  policy: SitePolicy & {
    profiles?: {
      id: string
      name: string
      scope: string
    }
  }
  profiles: Array<{ id: string; name: string; scope: string }>
  onUpdate: (id: string, updates: Partial<SitePolicy>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function SitePolicyCard({ policy, profiles, onUpdate, onDelete }: SitePolicyCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdate = async (updates: Partial<SitePolicy>) => {
    setIsLoading(true)
    try {
      await onUpdate(policy.id, updates)
    } catch (error) {
      console.error('Failed to update site policy:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to remove ${getDomainFromUrl(policy.origin)} from your allowed sites?`)) {
      setIsLoading(true)
      try {
        await onDelete(policy.id)
      } catch (error) {
        console.error('Failed to delete site policy:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="font-medium">{getDomainFromUrl(policy.origin)}</span>
          </div>
          <Badge variant="outline">
            {policy.profiles?.name || 'Unknown Profile'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Capture Context</p>
            <p className="text-xs text-muted-foreground">
              Automatically save conversations from this site
            </p>
          </div>
          <Switch
            checked={policy.capture}
            onCheckedChange={(checked) => handleUpdate({ capture: checked })}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Inject Context</p>
            <p className="text-xs text-muted-foreground">
              Share your context with AI on this site
            </p>
          </div>
          <Switch
            checked={policy.inject}
            onCheckedChange={(checked) => handleUpdate({ inject: checked })}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Profile</p>
            <p className="text-xs text-muted-foreground">
              Which context profile to use
            </p>
          </div>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit2 className="h-3 w-3 mr-1" />
                {policy.profiles?.name || 'Select'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Select
                  value={policy.profile_id}
                  onValueChange={(value) => {
                    handleUpdate({ profile_id: value })
                    setIsEditing(false)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name} ({profile.scope})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Settings className="h-3 w-3" />
            <span className="text-xs text-muted-foreground">Site Controls</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isLoading}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

