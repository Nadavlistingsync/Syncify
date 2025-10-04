'use client'

interface ExportManifest {
  export_info: {
    export_date: string
    user_id: string
    format: string
    version: string
    include_redacted: boolean
    chunk_size: number
    total_chunks: number
    data_types: string[]
  }
  chunks: Array<{
    data_type: string
    total_chunks: number
  }>
}

interface ExportChunk {
  chunk_id: string
  total_chunks: number
  current_chunk: number
  data_type: string
  data: any[]
  metadata: {
    export_date: string
    user_id: string
    format: string
    include_redacted: boolean
    chunk_size: number
  }
}

interface ExportProgress {
  totalChunks: number
  completedChunks: number
  currentDataType: string
  currentChunk: number
  totalChunksForDataType: number
  isDownloading: boolean
  error?: string
}

export class ChunkedExporter {
  private manifest: ExportManifest | null = null
  private allData: Record<string, any[]> = {}
  private progress: ExportProgress = {
    totalChunks: 0,
    completedChunks: 0,
    currentDataType: '',
    currentChunk: 0,
    totalChunksForDataType: 0,
    isDownloading: false
  }
  private onProgressUpdate?: (progress: ExportProgress) => void
  private cancelled = false

  constructor(onProgressUpdate?: (progress: ExportProgress) => void) {
    this.onProgressUpdate = onProgressUpdate
  }

  async startExport(format: 'json' | 'csv' = 'json', includeRedacted: boolean = false, chunkSize: number = 50): Promise<void> {
    try {
      this.cancelled = false
      this.progress.isDownloading = true
      this.progress.error = undefined
      this.updateProgress()

      // Get export manifest
      const manifestResponse = await fetch('/api/export/chunked', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          includeRedacted,
          chunkSize
        })
      })

      if (!manifestResponse.ok) {
        throw new Error('Failed to get export manifest')
      }

      this.manifest = await manifestResponse.json()
      if (!this.manifest) {
        throw new Error('Failed to get export manifest')
      }
      
      this.progress.totalChunks = this.manifest.export_info.total_chunks
      this.updateProgress()

      // Initialize data structure
      this.allData = {}
      this.manifest.export_info.data_types.forEach(dataType => {
        this.allData[dataType] = []
      })

      // Download all chunks
      await this.downloadAllChunks()

      if (!this.cancelled) {
        // Combine all data and download
        await this.combineAndDownload(format, includeRedacted)
      }

    } catch (error) {
      this.progress.error = error instanceof Error ? error.message : 'Unknown error occurred'
      this.progress.isDownloading = false
      this.updateProgress()
    }
  }

  private async downloadAllChunks(): Promise<void> {
    if (!this.manifest) return

    for (const chunkInfo of this.manifest.chunks) {
      if (this.cancelled) break

      this.progress.currentDataType = chunkInfo.data_type
      this.progress.totalChunksForDataType = chunkInfo.total_chunks
      this.updateProgress()

      // Download all chunks for this data type
      for (let chunkIndex = 0; chunkIndex < chunkInfo.total_chunks; chunkIndex++) {
        if (this.cancelled) break

        this.progress.currentChunk = chunkIndex
        this.updateProgress()

        try {
          const chunk = await this.downloadChunk(chunkInfo.data_type, chunkIndex)
          this.allData[chunkInfo.data_type].push(...chunk.data)
          this.progress.completedChunks++
          this.updateProgress()

          // Add small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`Failed to download chunk ${chunkIndex} for ${chunkInfo.data_type}:`, error)
          // Continue with next chunk instead of failing completely
        }
      }
    }
  }

  private async downloadChunk(dataType: string, chunkIndex: number): Promise<ExportChunk> {
    if (!this.manifest) {
      throw new Error('Export manifest not available')
    }

    const params = new URLSearchParams({
      dataType,
      chunk: chunkIndex.toString(),
      chunkSize: this.manifest.export_info.chunk_size.toString()
    })

    const response = await fetch(`/api/export/chunked?${params}`)
    
    if (!response.ok) {
      throw new Error(`Failed to download chunk ${chunkIndex} for ${dataType}`)
    }

    return await response.json()
  }

  private async combineAndDownload(format: string, includeRedacted: boolean): Promise<void> {
    if (!this.manifest) return

    const exportData = {
      export_info: {
        ...this.manifest.export_info,
        total_memories: this.allData.memories?.length || 0,
        total_conversations: this.allData.conversations?.length || 0,
        total_profiles: this.allData.profiles?.length || 0,
        total_sites: this.allData.site_policies?.length || 0,
        total_events: this.allData.events?.length || 0
      },
      data: this.allData
    }

    let blob: Blob
    let filename: string

    if (format === 'json') {
      blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      filename = `syncify-export-${new Date().toISOString().split('T')[0]}.json`
    } else {
      // Convert to CSV
      const csvData = this.convertToCSV(exportData)
      blob = new Blob([csvData], {
        type: 'text/csv'
      })
      filename = `syncify-export-${new Date().toISOString().split('T')[0]}.csv`
    }

    // Download the file
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    this.progress.isDownloading = false
    this.updateProgress()
  }

  private convertToCSV(exportData: any): string {
    const csvLines: string[] = []
    
    // Add export info
    csvLines.push('Export Information')
    csvLines.push('Key,Value')
    Object.entries(exportData.export_info).forEach(([key, value]) => {
      csvLines.push(`${key},"${value}"`)
    })
    
    csvLines.push('') // Empty line
    
    // Add each data type
    Object.entries(exportData.data).forEach(([dataType, data]: [string, any]) => {
      if (data.length > 0) {
        csvLines.push(dataType.charAt(0).toUpperCase() + dataType.slice(1))
        
        // Get headers from first item
        const headers = Object.keys(data[0])
        csvLines.push(headers.join(','))
        
        // Add data rows
        data.forEach((item: any) => {
          const row = headers.map(header => {
            let value = item[header]
            if (typeof value === 'object') {
              value = JSON.stringify(value)
            }
            return `"${String(value).replace(/"/g, '""')}"`
          })
          csvLines.push(row.join(','))
        })
        
        csvLines.push('') // Empty line
      }
    })
    
    return csvLines.join('\n')
  }

  private updateProgress(): void {
    this.onProgressUpdate?.(this.progress)
  }

  cancel(): void {
    this.cancelled = true
    this.progress.isDownloading = false
    this.progress.error = 'Export cancelled by user'
    this.updateProgress()
  }

  getProgress(): ExportProgress {
    return { ...this.progress }
  }
}
