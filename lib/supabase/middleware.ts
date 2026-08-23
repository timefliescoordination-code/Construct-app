import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { absoluteAppUrl } from '@/lib/app-url'
import { dashboardPath } from '@/lib/auth/dashboard-path'
import { getSupabaseEnv, isSupabaseConfigured } from '@/lib/supabase/env'

// Public routes that don't require authentication
const publicRoutes = ['/login', '/signup', '/auth/callback', '/auth/error', '/auth/signout', '/setup']

/** Telegram servers call the webhook without app cookies. Auth is via TELEGRAM_WEBHOOK_SECRET. */
function isTelegramWebhookRoute(pathname: string) {
  return pathname === '/api/telegram/webhook'
}

function isPublicApiRoute(pathname: string) {
  return pathname.startsWith('/api/auth/')
}

function redirectTo(request: NextRequest, pathname: string, reason?: string) {
  const response = NextResponse.redirect(absoluteAppUrl(pathname, request))
  if (reason) {
    response.headers.set('X-Auth-Debug-Redirect-Reason', reason)
    response.headers.set('X-Auth-Debug-Redirect-To', pathname)
  }
  return response
}

function attachMiddlewareAuthDebug(
  response: NextResponse,
  user: { id: string } | null,
  authCookieNames: string[],
) {
  response.headers.set('X-Auth-Debug-Middleware-User', user ? 'found' : 'none')
  response.headers.set('X-Auth-Debug-Auth-Cookie-Count', String(authCookieNames.length))
  if (authCookieNames.length > 0) {
    response.headers.set('X-Auth-Debug-Auth-Cookie-Names', authCookieNames.join(','))
  }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicRoute =
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    isTelegramWebhookRoute(pathname) ||
    isPublicApiRoute(pathname)

  if (!isSupabaseConfigured()) {
    if (pathname.startsWith('/setup') || isPublicRoute) {
      return NextResponse.next()
    }
    return redirectTo(request, '/setup')
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const { url, key } = getSupabaseEnv()

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const authCookieNames = request.cookies
    .getAll()
    .map((c) => c.name)
    .filter((name) => name.startsWith('sb-'))

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    const response = redirectTo(request, '/login', 'no-user')
    attachMiddlewareAuthDebug(response, null, authCookieNames)
    return response
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // If user is logged in and accessing root (/), redirect to their dashboard
    if (pathname === '/') {
      const response = redirectTo(request, dashboardPath(role), 'root-to-dashboard')
      attachMiddlewareAuthDebug(response, user, authCookieNames)
      return response
    }

    // Role-based route guard (site engineers and customers have limited surfaces)
    if (role === 'engineer') {
      if (
        pathname.startsWith('/admin') ||
        pathname === '/pm' ||
        pathname.startsWith('/projects/new') ||
        pathname.includes('/edit')
      ) {
        const response = redirectTo(request, '/engineer', 'engineer-route-guard')
        attachMiddlewareAuthDebug(response, user, authCookieNames)
        return response
      }
    }

    if (role === 'customer') {
      if (
        pathname.startsWith('/admin') ||
        pathname === '/pm' ||
        pathname === '/engineer' ||
        pathname.startsWith('/projects/new') ||
        pathname.includes('/edit') ||
        pathname.startsWith('/integrations')
      ) {
        const response = redirectTo(request, '/customer', 'customer-route-guard')
        attachMiddlewareAuthDebug(response, user, authCookieNames)
        return response
      }
    }

    if (role === 'pm') {
      if (pathname.startsWith('/admin')) {
        const response = redirectTo(request, '/pm', 'pm-admin-guard')
        attachMiddlewareAuthDebug(response, user, authCookieNames)
        return response
      }
    }
  }

  attachMiddlewareAuthDebug(supabaseResponse, user ?? null, authCookieNames)
  return supabaseResponse
}
