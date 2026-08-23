import { NextResponse } from 'next/server'
import { dashboardPath } from '@/lib/auth/dashboard-path'
import { absoluteAppUrl } from '@/lib/app-url'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { ok: false, error: 'Email, password, and full name are required.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const emailRedirectTo = absoluteAppUrl('/auth/callback', request)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName,
          role: 'admin',
        },
      },
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json(
        { ok: false, error: 'Could not create account.' },
        { status: 400 },
      )
    }

    if (data.user.identities && data.user.identities.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'This email is already registered. Please sign in instead.',
      })
    }

    if (data.session) {
      const { role, error: profileError } = await ensureUserProfile(supabase, data.user)
      if (profileError) {
        return NextResponse.json({ ok: false, error: profileError }, { status: 400 })
      }

      return NextResponse.json({
        ok: true,
        redirectTo: dashboardPath(role),
      })
    }

    return NextResponse.json({
      ok: true,
      redirectTo: '/login',
    })
  } catch (error) {
    console.error('[api/auth/signup-admin]', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to create account',
      },
      { status: 500 },
    )
  }
}
