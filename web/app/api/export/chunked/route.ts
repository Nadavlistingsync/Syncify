import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

const CHUNK_SIZE = 50 // Number of records per chunk
const MAX_CONCURRENT_CHUNKS = 3 // Maximum chunks to process concurrently

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const includeRedacted = searchParams.get('includeRedacted') === 'true'
    const dataType = searchParams.get('dataType') || 'memories' // memories, conversations, profiles, site_policies, events
    const chunk = parseInt(searchParams.get('chunk') || '0')
    const chunkSize = parseInt(searchParams.get('chunkSize') || CHUNK_SIZE.toString())

    // Get total count for the data type
    const { count } = await getTotalCount(supabase, user.id, dataType)
    
    if (!count) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    const totalChunks = Math.ceil(count / chunkSize)
    const offset = chunk * chunkSize

    // Fetch chunked data
    const chunkData = await fetchChunkData(supabase, user.id, dataType, chunkSize, offset, includeRedacted)
    
    const chunkResponse: ExportChunk = {
      chunk_id: `${dataType}-${chunk}`,
      total_chunks: totalChunks,
      current_chunk: chunk,
      data_type: dataType,
      data: chunkData,
      metadata: {
        export_date: new Date().toISOString(),
        user_id: user.id,
        format: format,
        include_redacted: includeRedacted,
        chunk_size: chunkSize
      }
    }

    return NextResponse.json(chunkResponse)

  } catch (error) {
    console.error('Chunked export API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { format = 'json', includeRedacted = false, chunkSize = CHUNK_SIZE } = body

    // Get export metadata for all data types
    const exportMetadata = await getExportMetadata(supabase, user.id, chunkSize)
    
    // Create export manifest
    const exportManifest = {
      export_info: {
        export_date: new Date().toISOString(),
        user_id: user.id,
        format: format,
        version: '2.0.0',
        include_redacted: includeRedacted,
        chunk_size: chunkSize,
        total_chunks: exportMetadata.total_chunks,
        data_types: exportMetadata.data_types
      },
      chunks: exportMetadata.chunks
    }

    return NextResponse.json(exportManifest)

  } catch (error) {
    console.error('Export manifest API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getTotalCount(supabase: any, userId: string, dataType: string): Promise<{ count: number | null }> {
  const tableMap: Record<string, string> = {
    memories: 'memories',
    conversations: 'conversations',
    profiles: 'profiles',
    site_policies: 'site_policies',
    events: 'events'
  }

  const table = tableMap[dataType]
  if (!table) {
    throw new Error(`Invalid data type: ${dataType}`)
  }

  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw error
  return { count }
}

async function fetchChunkData(supabase: any, userId: string, dataType: string, limit: number, offset: number, includeRedacted: boolean): Promise<any[]> {
  const baseQuery = supabase
    .from(dataType === 'site_policies' ? 'site_policies' : dataType)
    .select(dataType === 'conversations' ? `
      *,
      messages (
        id,
        role,
        content,
        ts,
        provider
      )
    ` : dataType === 'site_policies' ? `
      *,
      profiles (
        id,
        name,
        scope
      )
    ` : '*')
    .eq('user_id', userId)
    .order(dataType === 'events' ? 'ts' : 'created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error } = await baseQuery

  if (error) throw error

  let processedData = data || []

  // Apply redaction for memories if needed
  if (dataType === 'memories' && !includeRedacted) {
    const { redactMemoryContent } = await import('@/lib/redaction')
    processedData = processedData.map((memory: any) => ({
      ...memory,
      content: redactMemoryContent(memory.content, memory.pii)
    }))
  }

  return processedData
}

async function getExportMetadata(supabase: any, userId: string, chunkSize: number) {
  const dataTypes = ['memories', 'conversations', 'profiles', 'site_policies', 'events']
  const chunks: Array<{data_type: string, total_chunks: number}> = []
  let totalChunks = 0

  for (const dataType of dataTypes) {
    const { count } = await getTotalCount(supabase, userId, dataType)
    const dataTypeChunks = Math.ceil((count || 0) / chunkSize)
    
    chunks.push({
      data_type: dataType,
      total_chunks: dataTypeChunks
    })
    
    totalChunks += dataTypeChunks
  }

  return {
    total_chunks: totalChunks,
    data_types: dataTypes,
    chunks
  }
}
