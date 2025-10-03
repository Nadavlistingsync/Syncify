'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MemoryCard } from '@/components/memory-card'
import { AddMemoryDialog } from '@/components/add-memory-dialog'
import { Brain, Filter, Search, Info } from 'lucide-react'
import { Memory } from '@/lib/supabase'
import { createClient } from '@/lib/supabase'

export default function ContextPage() {
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch memories
  const { data: memories = [], isLoading } = useQuery({
    queryKey: ['memories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Memory[]
    }
  })

  // Add memory mutation
  const addMemoryMutation = useMutation({
    mutationFn: async (newMemory: {
      type: string
      content: string
      importance: number
      pii: boolean
    }) => {
      const { data, error } = await supabase
        .from('memories')
        .insert(newMemory)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    }
  })

  // Update memory mutation
  const updateMemoryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Memory> }) => {
      const { data, error } = await supabase
        .from('memories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    }
  })

  // Delete memory mutation
  const deleteMemoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    }
  })

  // Filter and search memories
  const filteredMemories = memories.filter(memory => {
    const matchesType = filterType === 'all' || memory.type === filterType
    const matchesSearch = memory.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesType && matchesSearch
  })

  // Get memory type counts
  const typeCounts = memories.reduce((acc, memory) => {
    acc[memory.type] = (acc[memory.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalMemories = memories.length
  const privateMemories = memories.filter(m => m.pii).length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Your Context</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          This is everything the AI knows about you. Add memories, facts, preferences, 
          and skills to help AI assistants provide better, more personalized responses.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalMemories}</div>
            <div className="text-sm text-muted-foreground">Total Memories</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{privateMemories}</div>
            <div className="text-sm text-muted-foreground">Private</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {memories.filter(m => m.importance >= 8).length}
            </div>
            <div className="text-sm text-muted-foreground">High Importance</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {Math.round(memories.reduce((acc, m) => acc + m.importance, 0) / totalMemories) || 0}
            </div>
            <div className="text-sm text-muted-foreground">Avg Importance</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="fact">Facts</SelectItem>
                <SelectItem value="preference">Preferences</SelectItem>
                <SelectItem value="skill">Skills</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="note">Notes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <AddMemoryDialog onAdd={addMemoryMutation.mutateAsync} />
      </div>

      {/* Type badges */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(typeCounts).map(([type, count]) => (
          <Badge
            key={type}
            variant={filterType === type ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterType(filterType === type ? 'all' : type)}
          >
            {type} ({count})
          </Badge>
        ))}
      </div>

      {/* Memories Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredMemories.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No memories found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterType !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Start by adding your first memory'
              }
            </p>
            {(!searchQuery && filterType === 'all') && (
              <AddMemoryDialog onAdd={addMemoryMutation.mutateAsync} />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMemories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onUpdate={updateMemoryMutation.mutateAsync}
              onDelete={deleteMemoryMutation.mutateAsync}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How this works:</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Memories are automatically shared with AI assistants you use</li>
                <li>• Private memories (marked with 🔒) are not shared with third-party sites</li>
                <li>• Higher importance memories are prioritized in context</li>
                <li>• The Chrome extension handles automatic synchronization</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

