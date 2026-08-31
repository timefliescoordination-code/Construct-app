import type { NextResponse } from 'next/server'

export type PendingAuthCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

type CookieOptions = Parameters<NextResponse['cookies']['set']>[2]

/** Session cookies must be sent on dashboard routes (/admin, /pm), not only /api/auth/*. */
export const AUTH_COOKIE_DEFAULTS: CookieOptions = {
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
}

/** Merge provider options but always keep session cookies site-wide. */
export function mergeAuthCookieOptions(options?: CookieOptions): CookieOptions {
  const merged: CookieOptions = {
    ...AUTH_COOKIE_DEFAULTS,
    ...options,
    path: '/',
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      ...merged,
      secure: false,
      domain: undefined,
    }
  }

  return merged
}

export function applyPendingAuthCookies(
  response: NextResponse,
  pendingCookies: PendingAuthCookie[],
) {
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, mergeAuthCookieOptions(options))
  }
}

/** Fallback when setAll captured values in the cookie store but not pendingCookies. */
export function applyAuthCookiesFromStore(
  response: NextResponse,
  cookies: { name: string; value: string }[],
) {
  for (const cookie of cookies) {
    if (!cookie.name.startsWith('sb-')) continue
    response.cookies.set(cookie.name, cookie.value, mergeAuthCookieOptions())
  }
}
