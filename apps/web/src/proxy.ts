import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { env } from '@/config/env'

/**
 * Next.js 16 Proxy Layer
 * Responsibilities:
 * 1. Intercept /api/* requests
 * 2. Rewrite request to backend API
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API requests: rewrite to backend
  if (pathname.startsWith('/api')) {
    const requestHeaders = new Headers(request.headers)

    // Rewrite to backend API, keep path consistent
    const upstreamUrl = new URL(pathname, env.API_UPSTREAM_BASE_URL)
    upstreamUrl.search = request.nextUrl.search

    return NextResponse.rewrite(upstreamUrl, {
      request: { headers: requestHeaders },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
