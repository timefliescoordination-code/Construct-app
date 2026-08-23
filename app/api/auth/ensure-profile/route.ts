import { NextResponse } from 'next/server'
import { dashboardPath } from '@/lib/auth/dashboard-path'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Not authenticated.' },
        { status: 401 },
      )
    }

    const { role, error } = await ensureUserProfile(supabase, user)
    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      role,
      redirectTo: dashboardPath(role),
    })
  } catch (error) {
    console.error('[api/auth/ensure-profile]', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not load profile',
      },
      { status: 500 },
    )
  }
}
