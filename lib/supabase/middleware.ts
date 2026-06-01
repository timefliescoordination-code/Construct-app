import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv, isSupabaseConfigured } from '@/lib/supabase/env'

// Public routes that don't require authentication
const publicRoutes = ['/login', '/signup', '/auth/callback', '/auth/error', '/auth/signout', '/setup']

/** Telegram servers call the webhook without app cookies. Auth is via TELEGRAM_WEBHOOK_SECRET. */
function isTelegramWebhookRoute(pathname: string) {
  return pathname === '/api/telegram/webhook'
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicRoute =
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    isTelegramWebhookRoute(pathname)

  if (!isSupabaseConfigured()) {
    if (pathname.startsWith('/setup') || isPublicRoute) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = '/setup'
    return NextResponse.redirect(url)
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
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
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
      const url = request.nextUrl.clone()
      if (role === 'admin') {
        url.pathname = '/admin'
      } else if (role === 'pm') {
        url.pathname = '/pm'
      } else if (role === 'engineer') {
        url.pathname = '/engineer'
      } else if (role === 'customer') {
        url.pathname = '/customer'
      } else {
        url.pathname = '/admin'
      }
      return NextResponse.redirect(url)
    }

    // Role-based route guard (site engineers and customers have limited surfaces)
    if (role === 'engineer') {
      if (
        pathname.startsWith('/admin') ||
        pathname === '/pm' ||
        pathname.startsWith('/projects/new') ||
        pathname.includes('/edit')
      ) {
        const url = request.nextUrl.clone()
        url.pathname = '/engineer'
        return NextResponse.redirect(url)
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
        const url = request.nextUrl.clone()
        url.pathname = '/customer'
        return NextResponse.redirect(url)
      }
    }

    if (role === 'pm') {
      if (pathname.startsWith('/admin')) {
        const url = request.nextUrl.clone()
        url.pathname = '/pm'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
