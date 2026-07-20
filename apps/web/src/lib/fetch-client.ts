import createFetchClient from 'openapi-fetch'
import createClient from 'openapi-react-query'

import { env } from '@/config/env'
import type { paths } from '@/types/openapi'

// ============================================================================
// Custom Errors
// ============================================================================

// Validation error field type
interface ValidationError {
  field: string
  pointer: string
  code: string
  message: string
}

// RFC 7807 error response (frontend fields only)
interface ProblemDetails {
  detail?: string
  errors?: ValidationError[]
  request_id?: string
  correlation_id?: string
}

export class ApiError extends Error {
  public detail?: string
  public errors?: ValidationError[]
  public requestId?: string

  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'

    // Extract RFC 7807 fields
    const problem = data as ProblemDetails
    this.detail = problem?.detail
    this.errors = problem?.errors
    this.requestId = problem?.request_id ?? problem?.correlation_id
  }
}

// ============================================================================
// Fetch Client
// ============================================================================

// API requests sent directly
// baseUrl is empty as OpenAPI paths include /api prefix
export const fetchClient = createFetchClient<paths>({
  baseUrl: '',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Middleware: unified server/client handling
fetchClient.use({
  async onRequest({ request }) {
    if (globalThis.window === undefined) {
      // Server: rewrite URL
      const url = new URL(request.url, env.API_UPSTREAM_BASE_URL)
      const newRequest = new Request(url, request)
      return newRequest
    }
    // Client: no processing
    return request
  },
})

// ============================================================================
// React Query Client
// ============================================================================

export const $api = createClient(fetchClient)
