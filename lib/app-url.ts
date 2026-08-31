import type { NextRequest } from 'next/server'

const DEFAULT_PRODUCTION_ORIGIN = 'https://vraconstruction.app'

function normalizeConfiguredOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return DEFAULT_PRODUCTION_ORIGIN
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  return `https://${trimmed}`
}

function isInvalidRedirectHost(host: string): boolean {
  const lower = host.toLowerCase()
  return lower.startsWith('0.0.0.0') || lower === '[::]' || lower.startsWith('[::]:')
}

type RequestLike = NextRequest | Request | { headers: Headers }

/** Public site origin for redirects (never 0.0.0.0 behind Hostinger reverse proxy). */
export function getPublicAppOrigin(request?: RequestLike): string {
  if (request) {
    const headers = request.headers
    const forwardedHost = headers.get('x-forwarded-host')
    const host = forwardedHost?.split(',')[0]?.trim() ?? headers.get('host') ?? ''
    const isLocalHost =
      /^localhost\b/i.test(host) ||
      /^127\.0\.0\.1\b/.test(host) ||
      /^\[::1\]/.test(host)

    if (
      host &&
      !isInvalidRedirectHost(host) &&
      (isLocalHost || process.env.NODE_ENV !== 'production')
    ) {
      const fallbackProto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      const proto =
        (headers.get('x-forwarded-proto') ?? fallbackProto).split(',')[0]?.trim() ||
        fallbackProto
      return `${proto}://${host}`
    }
  }

  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (configured) {
    return normalizeConfiguredOrigin(configured)
  }

  if (request) {
    const headers = request.headers
    const forwardedHost = headers.get('x-forwarded-host')
    const host = forwardedHost?.split(',')[0]?.trim() ?? headers.get('host') ?? ''
    const proto = (headers.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim()

    if (host && !isInvalidRedirectHost(host)) {
      return `${proto}://${host}`
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return DEFAULT_PRODUCTION_ORIGIN
  }

  return 'http://localhost:3000'
}

export function absoluteAppUrl(path: string, request?: RequestLike): string {
  const origin = getPublicAppOrigin(request)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${origin}${normalizedPath}`
}
