import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv, isSupabaseConfigured } from '@/lib/supabase/env'

// Public routes that don't require authentication
const publicRoutes = ['/login', '/signup', '/auth/callback', '/auth/error', '/auth/signout', '/setup']

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

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

  // If user is logged in and accessing root (/), redirect to their dashboard
  if (user && pathname === '/') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    if (profile?.role === 'admin') {
      url.pathname = '/admin'
    } else if (profile?.role === 'pm') {
      url.pathname = '/pm'
    } else if (profile?.role === 'engineer') {
      url.pathname = '/engineer'
    } else if (profile?.role === 'customer') {
      url.pathname = '/customer'
    } else {
      url.pathname = '/admin'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
