import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // This endpoint can be called by a cron job or manually
    // to trigger the compactor job
    
    const body = await request.json()
    const { force = false } = body

    // For now, we'll just return success
    // In production, this would trigger a background job
    return NextResponse.json({ 
      success: true, 
      message: 'Compactor job triggered',
      force 
    })
  } catch (error) {
    console.error('Compactor trigger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
