import { createAdminClient } from '@/lib/supabase/server'
import type { ExpenseSessionPayload, TelegramSessionState } from '@/lib/telegram/types'
import type { UserRole } from '@/lib/types/database'

export type LinkedTelegramAccount = {
  profileId: string
  role: UserRole
  fullName: string
  telegramUserId: number
}

export async function findLinkedAccount(
  telegramUserId: number,
): Promise<LinkedTelegramAccount | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('telegram_accounts')
    .select('profile_id, telegram_user_id, profiles(full_name, role)')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle()

  if (error || !data?.profiles) return null

  const raw = data.profiles as
    | { full_name: string; role: UserRole }
    | { full_name: string; role: UserRole }[]
  const profile = Array.isArray(raw) ? raw[0] : raw
  if (!profile) return null
  if (profile.role !== 'engineer' && profile.role !== 'admin' && profile.role !== 'pm') {
    return null
  }

  return {
    profileId: data.profile_id,
    role: profile.role,
    fullName: profile.full_name || 'User',
    telegramUserId: data.telegram_user_id,
  }
}

export async function getSession(chatId: number) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('telegram_sessions')
    .select('state, payload, profile_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  return {
    state: (data?.state ?? 'idle') as TelegramSessionState,
    payload: (data?.payload ?? {}) as ExpenseSessionPayload,
    profileId: data?.profile_id ?? null,
  }
}

export async function setSession(
  chatId: number,
  input: {
    state: TelegramSessionState
    payload?: ExpenseSessionPayload
    profileId?: string | null
  },
) {
  const supabase = createAdminClient()
  const existing = await getSession(chatId)
  const payload = input.payload ?? existing.payload

  await supabase.from('telegram_sessions').upsert(
    {
      telegram_chat_id: chatId,
      state: input.state,
      payload,
      profile_id: input.profileId ?? existing.profileId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_chat_id' },
  )
}

export async function clearSession(chatId: number) {
  await setSession(chatId, { state: 'idle', payload: {}, profileId: null })
}

export async function redeemLinkCode(input: {
  code: string
  telegramUserId: number
  telegramChatId: number
  telegramUsername?: string
}): Promise<{ ok: true; fullName: string } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  const normalized = input.code.trim().toUpperCase()

  const { data: row, error } = await supabase
    .from('telegram_link_codes')
    .select('id, profile_id, expires_at, used_at, profiles(full_name, role)')
    .eq('code', normalized)
    .maybeSingle()

  if (error || !row) {
    return { ok: false, error: 'Invalid link code. Generate a new one in the app.' }
  }

  if (row.used_at) {
    return { ok: false, error: 'This code was already used.' }
  }

  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: 'This code expired. Generate a new one in the app.' }
  }

  const rawProfile = row.profiles as
    | { full_name: string; role: UserRole }
    | { full_name: string; role: UserRole }[]
  const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
  if (!profile) {
    return { ok: false, error: 'Profile not found.' }
  }
  if (profile.role !== 'engineer' && profile.role !== 'admin' && profile.role !== 'pm') {
    return {
      ok: false,
      error: 'Only site engineers, PMs, or admins can link Telegram for expenses.',
    }
  }

  await supabase
    .from('telegram_link_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id)

  await supabase.from('telegram_accounts').delete().eq('telegram_user_id', input.telegramUserId)

  const { error: insertError } = await supabase.from('telegram_accounts').insert({
    profile_id: row.profile_id,
    telegram_user_id: input.telegramUserId,
    telegram_chat_id: input.telegramChatId,
    telegram_username: input.telegramUsername ?? null,
  })

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  await setSession(input.telegramChatId, {
    state: 'idle',
    payload: {},
    profileId: row.profile_id,
  })

  return { ok: true, fullName: profile.full_name || 'there' }
}

export async function listProjectsForProfile(profileId: string, role: UserRole) {
  const supabase = createAdminClient()

  if (role === 'admin') {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .neq('status', 'archived')
      .order('name')
    return data ?? []
  }

  if (role === 'pm') {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('pm_id', profileId)
      .neq('status', 'archived')
      .order('name')
    return data ?? []
  }

  const { data } = await supabase
    .from('project_engineers')
    .select('project_id, projects!inner(id, name, status)')
    .eq('engineer_id', profileId)

  return (data ?? [])
    .map((row) => {
      const raw = row.projects as
        | { id: string; name: string; status: string }
        | { id: string; name: string; status: string }[]
      const project = Array.isArray(raw) ? raw[0] : raw
      if (!project || project.status === 'archived') return null
      return { id: project.id, name: project.name }
    })
    .filter((p): p is { id: string; name: string } => p !== null)
}
