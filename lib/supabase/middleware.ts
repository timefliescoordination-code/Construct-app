import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { absoluteAppUrl } from '@/lib/app-url'
import { dashboardPath } from '@/lib/auth/dashboard-path'
import { getSupabaseEnv, isSupabaseConfigured } from '@/lib/supabase/env'

// Public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup',
  '/auth/callback',
  '/auth/error',
  '/auth/signout',
  '/setup',
]

/** Public client quotation — must not match /proposals (admin list). */
function isPublicProposalRoute(pathname: string) {
  return pathname === '/proposal' || pathname.startsWith('/proposal/')
}

/** Telegram servers call the webhook without app cookies. Auth is via TELEGRAM_WEBHOOK_SECRET. */
function isTelegramWebhookRoute(pathname: string) {
  return pathname === '/api/telegram/webhook'
}

/** Deploy health check — documented as public; must not require a staff session. */
function isTelegramHealthRoute(pathname: string) {
  return pathname === '/api/telegram/health'
}

function isPublicApiRoute(pathname: string) {
  return (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/public/') ||
    pathname === '/api/company/branding' ||
    isTelegramHealthRoute(pathname)
  )
}

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(absoluteAppUrl(pathname, request))
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicRoute =
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    isPublicProposalRoute(pathname) ||
    isTelegramWebhookRoute(pathname) ||
    isTelegramHealthRoute(pathname) ||
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
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
      return redirectTo(request, dashboardPath(role))
    }

    // Role-based route guard (site engineers and customers have limited surfaces)
    if (role === 'engineer') {
      if (
        pathname.startsWith('/admin') ||
        pathname === '/pm' ||
        pathname.startsWith('/proposals') ||
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
        pathname.startsWith('/change-requests') ||
        pathname.startsWith('/inspections') ||
        pathname.startsWith('/proposals') ||
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
