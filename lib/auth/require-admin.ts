import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type { SupabaseServerClient }

export type AdminSessionResult =
  | { ok: true; supabase: SupabaseServerClient; user: User }
  | { ok: false; error: string }

/** Shared admin guard for server actions and API routes. */
export async function requireAdminSession(): Promise<AdminSessionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  if (profile?.role !== 'admin') {
    return { ok: false, error: 'Admin access required.' }
  }

  return { ok: true, supabase, user }
}

export type AdminApiResult =
  | { error: NextResponse }
  | { supabase: SupabaseServerClient; user: User }

/** Admin guard for Route Handlers (returns NextResponse on failure). */
export async function requireAdminApi(): Promise<AdminApiResult> {
  const session = await requireAdminSession()

  if (!session.ok) {
    if (session.error === 'You must be signed in.') {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }
    return {
      error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    }
  }

  return { supabase: session.supabase, user: session.user }
}
