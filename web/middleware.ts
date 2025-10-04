// Security Middleware for SOC 2, SOC 1, and GDPR Compliance
import { NextRequest, NextResponse } from 'next/server'
import { 
  RateLimitService, 
  AuditLogService, 
  InputValidationService, 
  SECURITY_HEADERS,
  AccessControlService
} from './lib/security'

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Extract user ID from JWT if available
  let userId = 'anonymous'
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      // Decode JWT to get user ID (without verification for middleware)
      const payload = JSON.parse(atob(token.split('.')[1]))
      userId = payload.userId || 'anonymous'
    }
  } catch {
    // Invalid token, continue as anonymous
  }

  // 1. Rate Limiting
  const rateLimitKey = `${ip}:${request.nextUrl.pathname}`
  const rateLimitAllowed = await RateLimitService.checkRateLimit(rateLimitKey)
  
  if (!rateLimitAllowed) {
    await AuditLogService.logEvent(
      userId,
      'rate_limit_exceeded',
      request.nextUrl.pathname,
      'block',
      { ip, userAgent, limit: 'exceeded' },
      ip,
      userAgent
    )
    
    return new NextResponse('Rate limit exceeded', { 
      status: 429,
      headers: {
        'Retry-After': '900', // 15 minutes
        ...SECURITY_HEADERS
      }
    })
  }

  // 2. Security Headers
  const response = NextResponse.next()
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // 3. Input Validation for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const body = await request.clone().text()
      if (body) {
        // Basic SQL injection detection
        const sqlPatterns = [
          /('|(\\')|(;)|(\\;)|(\\)|(\\\\)|(union)|(select)|(insert)|(update)|(delete)|(drop)|(create)|(alter)|(exec)|(execute))/i
        ]
        
        if (sqlPatterns.some(pattern => pattern.test(body))) {
          await AuditLogService.logEvent(
            userId,
            'sql_injection_attempt',
            request.nextUrl.pathname,
            'block',
            { ip, userAgent, body: body.substring(0, 100) },
            ip,
            userAgent
          )
          
          return new NextResponse('Invalid input detected', { 
            status: 400,
            headers: SECURITY_HEADERS
          })
        }
      }
    } catch {
      // Body parsing failed, continue
    }
  }

  // 4. Audit Logging for sensitive operations
  if (isSensitiveEndpoint(request.nextUrl.pathname)) {
    await AuditLogService.logEvent(
      userId,
      'sensitive_access',
      request.nextUrl.pathname,
      request.method.toLowerCase(),
      { 
        ip, 
        userAgent, 
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      },
      ip,
      userAgent
    )
  }

  // 5. CORS for API endpoints
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      'http://localhost:3002',
      'https://localhost:3002',
      'https://syncify.vercel.app',
      'chrome-extension://' // Chrome extensions
    ]
    
    if (origin && allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  // 6. Request timing and performance monitoring
  const responseTime = Date.now() - startTime
  if (responseTime > 5000) { // Log slow requests
    await AuditLogService.logEvent(
      userId,
      'slow_request',
      request.nextUrl.pathname,
      'monitor',
      { responseTime, ip, userAgent },
      ip,
      userAgent
    )
  }

  return response
}

function isSensitiveEndpoint(pathname: string): boolean {
  const sensitivePaths = [
    '/api/auth/',
    '/api/export/',
    '/api/analytics/',
    '/api/user-context/',
    '/api/memories/',
    '/api/conversations/',
    '/api/profiles/',
    '/api/site-policies/'
  ]
  
  return sensitivePaths.some(path => pathname.startsWith(path))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
