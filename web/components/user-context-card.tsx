'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Edit, Trash2, Eye, EyeOff, Calendar, Globe, Bot, MessageSquare } from 'lucide-react'

interface UserContext {
  id: string
  site: string
  provider: string
  context_type: string
  title: string
  content: string
  importance: number
  pii: boolean
  metadata: any
  created_at: string
  updated_at: string
  conversations?: {
    id: string
    title: string
    provider: string
    site: string
  }
}

interface UserContextCardProps {
  context: UserContext
  onUpdate: (id: string, updates: Partial<UserContext>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function UserContextCard({ context, onUpdate, onDelete }: UserContextCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    title: context.title,
    content: context.content,
    importance: context.importance,
    pii: context.pii
  })

  const handleSave = async () => {
    try {
      await onUpdate(context.id, editData)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update context:', error)
    }
  }

  const handleCancel = () => {
    setEditData({
      title: context.title,
      content: context.content,
      importance: context.importance,
      pii: context.pii
    })
    setIsEditing(false)
  }

  const getImportanceColor = (importance: number) => {
    if (importance >= 8) return 'bg-red-100 text-red-800 border-red-200'
    if (importance >= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'conversation':
        return <MessageSquare className="h-4 w-4" />
      case 'preference':
        return <Eye className="h-4 w-4" />
      case 'fact':
        return <Bot className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon(context.context_type)}
            <CardTitle className="text-lg">
              {isEditing ? (
                <Input
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="text-lg font-semibold border-none p-0 h-auto"
                />
              ) : (
                truncateContent(context.title, 60)
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getImportanceColor(context.importance)}>
              {editData.importance}/10
            </Badge>
            {context.pii && (
              <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                <EyeOff className="h-3 w-3 mr-1" />
                Private
              </Badge>
            )}
            <Badge variant="outline">{context.context_type}</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {context.site}
          </div>
          <div className="flex items-center gap-1">
            <Bot className="h-3 w-3" />
            {context.provider}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(context.created_at)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editData.content}
              onChange={(e) => setEditData({ ...editData, content: e.target.value })}
              rows={4}
              placeholder="Context content..."
            />
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Importance:</label>
                <Select
                  value={editData.importance.toString()}
                  onValueChange={(value) => setEditData({ ...editData, importance: parseInt(value) })}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                      <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Private:</label>
                <Switch
                  checked={editData.pii}
                  onCheckedChange={(checked) => setEditData({ ...editData, pii: checked })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm">
                Save
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {truncateContent(context.content)}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {context.content.length} characters
              </div>
              
              <div className="flex gap-1">
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="ghost"
                  size="sm"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  onClick={() => onDelete(context.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}

        {context.conversations && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              From conversation: {context.conversations.title}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
