import { NextResponse } from 'next/server'
import { dashboardPath } from '@/lib/auth/dashboard-path'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

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

    const supabase = await createClient()
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

    const { role, error: profileError } = await ensureUserProfile(supabase, data.user)
    if (profileError) {
      return NextResponse.json({ ok: false, error: profileError }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      role,
      redirectTo: dashboardPath(role),
    })
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
