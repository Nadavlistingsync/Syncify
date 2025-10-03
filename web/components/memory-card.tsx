'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MemoryForm } from './memory-form'
import { Edit2, Trash2, Star, Eye, EyeOff } from 'lucide-react'
import { formatRelativeTime, truncateText } from '@/lib/utils'
import { Memory } from '@/lib/supabase'

interface MemoryCardProps {
  memory: Memory
  onUpdate: (id: string, updates: Partial<Memory>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function MemoryCard({ memory, onUpdate, onDelete }: MemoryCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async (formData: {
    type: string
    content: string
    importance: number
    pii: boolean
  }) => {
    setIsLoading(true)
    try {
      await onUpdate(memory.id, {
        type: formData.type as Memory['type'],
        content: formData.content,
        importance: formData.importance,
        pii: formData.pii
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update memory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this memory?')) {
      setIsLoading(true)
      try {
        await onDelete(memory.id)
      } catch (error) {
        console.error('Failed to delete memory:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const getTypeColor = (type: Memory['type']) => {
    switch (type) {
      case 'fact': return 'bg-blue-100 text-blue-800'
      case 'preference': return 'bg-green-100 text-green-800'
      case 'skill': return 'bg-purple-100 text-purple-800'
      case 'project': return 'bg-orange-100 text-orange-800'
      case 'note': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getImportanceStars = (importance: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${
          i < importance ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ))
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getTypeColor(memory.type)}>
              {memory.type}
            </Badge>
            {memory.pii && (
              <Badge variant="outline" className="text-red-600 border-red-300">
                <EyeOff className="h-3 w-3 mr-1" />
                Private
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {getImportanceStars(memory.importance)}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatRelativeTime(memory.created_at)}
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm leading-relaxed mb-4">
          {truncateText(memory.content, 200)}
        </p>
        
        <div className="flex items-center gap-2">
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Memory</DialogTitle>
              </DialogHeader>
              <MemoryForm
                initialData={{
                  type: memory.type,
                  content: memory.content,
                  importance: memory.importance,
                  pii: memory.pii
                }}
                onSubmit={handleSave}
                onCancel={() => setIsEditing(false)}
                isLoading={isLoading}
              />
            </DialogContent>
          </Dialog>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isLoading}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

