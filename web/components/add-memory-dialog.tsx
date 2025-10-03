'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { MemoryForm } from './memory-form'

interface AddMemoryDialogProps {
  onAdd: (memory: {
    type: string
    content: string
    importance: number
    pii: boolean
  }) => Promise<void>
}

export function AddMemoryDialog({ onAdd }: AddMemoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (memoryData: {
    type: string
    content: string
    importance: number
    pii: boolean
  }) => {
    setIsLoading(true)
    try {
      await onAdd(memoryData)
      setOpen(false)
    } catch (error) {
      console.error('Failed to add memory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Memory
        </Button>
      </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Memory</DialogTitle>
          </DialogHeader>
          <MemoryForm
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            isLoading={isLoading}
          />
        </DialogContent>
    </Dialog>
  )
}

