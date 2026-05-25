'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import type { UserRole } from '@/lib/types/database'

async function siteOrigin(): Promise<string | undefined> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return undefined
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export type AuthActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string }

function dashboardPath(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'pm':
      return '/pm'
    case 'engineer':
      return '/engineer'
    case 'customer':
      return '/customer'
    default:
      return '/admin'
  }
}

export async function signInWithPasswordAction(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    if (!data.user) {
      return { ok: false, error: 'Sign in failed. Check your email and password.' }
    }

    const { role, error: profileError } = await ensureUserProfile(supabase, data.user)
    if (profileError) {
      return { ok: false, error: profileError }
    }

    return { ok: true, redirectTo: dashboardPath(role) }
  } catch (err) {
    console.error('[signInWithPasswordAction]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Sign in failed',
    }
  }
}

export async function signUpAdminAction(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthActionResult> {
  try {
    const supabase = await createClient()
    const origin = await siteOrigin()
    const emailRedirectTo = origin ? `${origin}/auth/callback` : undefined

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
      return { ok: false, error: error.message }
    }

    if (!data.user) {
      return { ok: false, error: 'Could not create account' }
    }

    if (data.user.identities && data.user.identities.length === 0) {
      return {
        ok: false,
        error: 'This email is already registered. Please sign in instead.',
      }
    }

    if (data.session) {
      const { role, error: profileError } = await ensureUserProfile(supabase, data.user)
      if (profileError) {
        return { ok: false, error: profileError }
      }
      return { ok: true, redirectTo: dashboardPath(role) }
    }

    return {
      ok: true,
      redirectTo: '/login',
    }
  } catch (err) {
    console.error('[signUpAdminAction]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create account',
    }
  }
}
