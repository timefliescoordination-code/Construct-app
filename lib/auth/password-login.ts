import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { dashboardPath } from '@/lib/auth/dashboard-path'
import {
  applyAuthCookiesFromStore,
  applyPendingAuthCookies,
  type PendingAuthCookie,
} from '@/lib/auth/session-cookies'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import { getSupabaseEnv, isSupabaseConfigured } from '@/lib/supabase/env'

/** Password login that works from middleware (Hostinger) and from the App Router route. */
export async function performPasswordLogin(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Supabase is not configured on the server. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Hostinger hPanel, then redeploy.',
      },
      { status: 503 },
    )
  }

  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Email and password are required.' },
        { status: 400 },
      )
    }

    const { url, key } = getSupabaseEnv()
    const pendingCookies: PendingAuthCookie[] = []
    const snapshot = request.cookies.getAll()

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options })
            request.cookies.set(name, value)
          })
        },
      },
    })

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json(
        { ok: false, error: 'Sign in failed. Check your email and password.' },
        { status: 400 },
      )
    }

    if (data.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
    }

    const { role, error: profileError } = await ensureUserProfile(supabase, data.user)
    if (profileError) {
      return NextResponse.json({ ok: false, error: profileError }, { status: 400 })
    }

    const redirectTo = dashboardPath(role)
    const response = NextResponse.json({
      ok: true,
      role,
      redirectTo,
    })

    applyPendingAuthCookies(response, pendingCookies)
    if (pendingCookies.length === 0) {
      applyAuthCookiesFromStore(response, [...snapshot, ...request.cookies.getAll()])
    }

    return response
  } catch (error) {
    console.error('[auth/password-login]', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Sign in failed',
      },
      { status: 500 },
    )
  }
}
