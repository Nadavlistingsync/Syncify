import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.searchParams.get('origin')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to the extension if origin is provided
  if (origin) {
    return NextResponse.redirect(`${origin}?auth=success`)
  }

  // Default redirect to the web app
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/context`)
}

