import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { dashboardPath } from '@/lib/auth/dashboard-path'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import { getSupabaseEnv, isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
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

    const cookieStore = await cookies()
    const { url, key } = getSupabaseEnv()

    const pendingCookies: {
      name: string
      value: string
      options?: Parameters<NextResponse['cookies']['set']>[2]
    }[] = []

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options })
            cookieStore.set(name, value, options)
          })
        },
      },
    })

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // #region agent log
    fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'afacb8'},body:JSON.stringify({sessionId:'afacb8',location:'api/auth/login/route.ts:postSignIn',message:'signInWithPassword result',data:{hasError:Boolean(error),hasUser:Boolean(data?.user),pendingCookieCount:pendingCookies.length,cookieNames:pendingCookies.map((c)=>c.name)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json(
        { ok: false, error: 'Sign in failed. Check your email and password.' },
        { status: 400 },
      )
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

    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options)
    }

    // #region agent log
    fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'afacb8'},body:JSON.stringify({sessionId:'afacb8',location:'api/auth/login/route.ts:response',message:'login success response',data:{redirectTo,responseCookieCount:response.cookies.getAll().length},timestamp:Date.now(),hypothesisId:'H1-H2'})}).catch(()=>{});
    // #endregion

    return response
  } catch (error) {
    console.error('[api/auth/login]', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Sign in failed',
      },
      { status: 500 },
    )
  }
}
