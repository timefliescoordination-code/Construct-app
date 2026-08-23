import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { absoluteAppUrl } from '@/lib/app-url'
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

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(absoluteAppUrl(pathname, request))
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    return redirectTo(request, '/login')
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
      if (role === 'admin') {
        return redirectTo(request, '/admin')
      }
      if (role === 'pm') {
        return redirectTo(request, '/pm')
      }
      if (role === 'engineer') {
        return redirectTo(request, '/engineer')
      }
      if (role === 'customer') {
        return redirectTo(request, '/customer')
      }
      return redirectTo(request, '/admin')
    }

    // Role-based route guard (site engineers and customers have limited surfaces)
    if (role === 'engineer') {
      if (
        pathname.startsWith('/admin') ||
        pathname === '/pm' ||
        pathname.startsWith('/projects/new') ||
        pathname.includes('/edit')
      ) {
        return redirectTo(request, '/engineer')
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
        return redirectTo(request, '/customer')
      }
    }

    if (role === 'pm') {
      if (pathname.startsWith('/admin')) {
        return redirectTo(request, '/pm')
      }
    }
  }

  return supabaseResponse
}
