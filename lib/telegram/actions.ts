'use server'

import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { isTelegramConfigured, getTelegramBotUsername } from '@/lib/telegram/config'
import type { UserRole } from '@/lib/types/database'

export type TelegramLinkCodeResult =
  | {
      ok: true
      code: string
      expiresAt: string
      botUsername: string
      isLinked: boolean
    }
  | { ok: false; error: string }

function generateLinkCode(): string {
  return randomBytes(3).toString('hex').toUpperCase()
}

export async function createTelegramLinkCodeAction(): Promise<TelegramLinkCodeResult> {
  if (!isTelegramConfigured()) {
    return {
      ok: false,
      error: 'Telegram bot is not configured. Add TELEGRAM_BOT_TOKEN to your environment.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Sign in to generate a Telegram link code.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, error: getSupabaseErrorMessage(profileError) }
  }

  const role = profile?.role as UserRole | undefined
  if (!role || (role !== 'engineer' && role !== 'admin' && role !== 'pm')) {
    return {
      ok: false,
      error: 'Only engineers, PMs, and admins can link Telegram for expenses.',
    }
  }

  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('telegram_accounts')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const code = generateLinkCode()

  await admin
    .from('telegram_link_codes')
    .delete()
    .eq('profile_id', user.id)
    .is('used_at', null)

  const { error: insertError } = await admin.from('telegram_link_codes').insert({
    profile_id: user.id,
    code,
    expires_at: expiresAt,
  })

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  return {
    ok: true,
    code,
    expiresAt,
    botUsername: getTelegramBotUsername(),
    isLinked: Boolean(existing),
  }
}

export async function getTelegramLinkStatusAction(): Promise<{
  configured: boolean
  isLinked: boolean
  botUsername: string
}> {
  const configured = isTelegramConfigured()
  if (!configured) {
    return { configured: false, isLinked: false, botUsername: '' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { configured: true, isLinked: false, botUsername: getTelegramBotUsername() }
  }

  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = createAdminClient()
  const { data } = await admin
    .from('telegram_accounts')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  return {
    configured: true,
    isLinked: Boolean(data),
    botUsername: getTelegramBotUsername(),
  }
}
