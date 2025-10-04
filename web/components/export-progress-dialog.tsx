'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface ExportProgressDialogProps {
  isOpen: boolean
  onClose: () => void
  onCancel: () => void
  exportProgress: {
    totalChunks: number
    completedChunks: number
    currentDataType: string
    currentChunk: number
    totalChunksForDataType: number
    isDownloading: boolean
    error?: string
  }
}

export function ExportProgressDialog({ 
  isOpen, 
  onClose, 
  onCancel, 
  exportProgress 
}: ExportProgressDialogProps) {
  const [showSuccess, setShowSuccess] = useState(false)

  const progressPercentage = exportProgress.totalChunks > 0 
    ? (exportProgress.completedChunks / exportProgress.totalChunks) * 100 
    : 0

  const dataTypeProgress = exportProgress.totalChunksForDataType > 0
    ? (exportProgress.currentChunk / exportProgress.totalChunksForDataType) * 100
    : 0

  useEffect(() => {
    if (exportProgress.totalChunks > 0 && exportProgress.completedChunks === exportProgress.totalChunks) {
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onClose()
      }, 2000)
    }
  }, [exportProgress.completedChunks, exportProgress.totalChunks, onClose])

  const getStatusMessage = () => {
    if (exportProgress.error) {
      return `Error: ${exportProgress.error}`
    }
    if (showSuccess) {
      return 'Export completed successfully!'
    }
    if (exportProgress.isDownloading) {
      return `Downloading ${exportProgress.currentDataType} (${exportProgress.currentChunk + 1}/${exportProgress.totalChunksForDataType})`
    }
    return 'Preparing export...'
  }

  const getStatusColor = () => {
    if (exportProgress.error) return 'text-red-600'
    if (showSuccess) return 'text-green-600'
    return 'text-blue-600'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Progress</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span className={getStatusColor()}>
                {exportProgress.completedChunks}/{exportProgress.totalChunks} chunks
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Current Data Type Progress */}
          {exportProgress.isDownloading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{exportProgress.currentDataType}</span>
                <span>{Math.round(dataTypeProgress)}%</span>
              </div>
              <Progress value={dataTypeProgress} className="h-2" />
            </div>
          )}

          {/* Status Message */}
          <div className="text-center">
            <p className={`text-sm ${getStatusColor()}`}>
              {getStatusMessage()}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            {exportProgress.isDownloading && !showSuccess && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {(!exportProgress.isDownloading || showSuccess || exportProgress.error) && (
              <Button onClick={onClose}>
                {exportProgress.error ? 'Close' : 'Done'}
              </Button>
            )}
          </div>

          {/* Download Stats */}
          {exportProgress.isDownloading && (
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>Downloading data in small chunks to prevent timeouts</p>
              <p>This may take a few minutes for large datasets</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
