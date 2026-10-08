// Thin fetch wrapper for the Grabity API. The auth cookie is HttpOnly and same-origin,
// so requests carry it automatically.

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  signal?: AbortSignal
}

export function buildQuery(query?: Query): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

/**
 * API responses the server embedded in the page (SpaRenderer.cs), so the first render doesn't wait for
 * requests it already knows the answer to. Keyed by URL with query parameters sorted by name.
 */
const embedded = readEmbedded()
const embeddedFreshFor = 30_000

function readEmbedded(): Map<string, unknown> {
  const element = typeof document === 'undefined' ? null : document.getElementById('grabity-data')
  if (!element?.textContent) return new Map()
  try {
    return new Map(Object.entries(JSON.parse(element.textContent) as Record<string, unknown>))
  } catch {
    return new Map()
  } finally {
    element.remove()
  }
}

function embeddedKey(url: string): string {
  const [path, search = ''] = url.split('?')
  const params = [...new URLSearchParams(search)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return params.length ? `${path}?${params.map(([key, value]) => `${key}=${value}`).join('&')}` : path!
}

/** Hands out an embedded response once; later requests for the same URL go to the server for fresh data. */
function takeEmbedded(url: string): { found: boolean; data?: unknown } {
  if (embedded.size === 0) return { found: false }
  if (performance.now() > embeddedFreshFor) {
    embedded.clear()
    return { found: false }
  }
  const key = embeddedKey(url)
  if (!embedded.has(key)) return { found: false }
  const data = embedded.get(key)
  embedded.delete(key)
  return { found: true, data }
}

/**
 * The embedded response for a GET request, for a query's `initialData`: the very first render then already
 * has the data, rather than rendering empty and again a moment later (which can also shift the layout).
 */
export function embeddedResponse<T>(path: string, query?: Query): T | undefined {
  const hit = takeEmbedded(`/api${path}${buildQuery(query)}`)
  return hit.found ? (hit.data as T) : undefined
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options
  const url = `/api${path}${buildQuery(query)}`
  if (method === 'GET') {
    const hit = takeEmbedded(url)
    if (hit.found) return hit.data as T
  }

  const isForm = body instanceof FormData
  const response = await fetch(url, {
    method,
    signal,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const data = text ? safeJson(text) : undefined

  if (!response.ok) {
    throw toApiError(response.status, data)
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toApiError(status: number, data: unknown): ApiError {
  const problem = (typeof data === 'object' && data) || {}
  const fieldErrors = ((problem as { errors?: Record<string, string[]> }).errors ?? {}) as Record<string, string[]>
  const firstFieldError = Object.values(fieldErrors).flat()[0]
  const title = (problem as { title?: string }).title
  const fallback =
    status === 401 ? 'Please sign in to continue.'
    : status === 403 ? "You don't have permission to do that."
    : status === 404 ? 'Not found.'
    : status === 429 ? 'Too many attempts. Please wait a minute and try again.'
    : 'Something went wrong. Please try again.'
  const message = firstFieldError ?? (title && title !== 'One or more validation errors occurred.' ? title : fallback)
  return new ApiError(status, message, fieldErrors)
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => api<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: body ?? {} }),
  delete: <T = void>(path: string) => api<T>(path, { method: 'DELETE' }),
  upload: async (file: File, folder: string) => {
    const form = new FormData()
    form.append('file', file)
    return api<{ url: string }>('/admin/uploads', { method: 'POST', body: form, query: { folder } })
  },
}
