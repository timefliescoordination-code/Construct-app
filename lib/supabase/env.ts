const PLACEHOLDER_VALUES = new Set([
  'your-anon-key',
  'your-service-role-key',
  'https://YOUR_PROJECT_REF.supabase.co',
  'REPLACE_WITH_PUBLISHABLE_OR_ANON_KEY',
  'REPLACE_WITH_SECRET_OR_SERVICE_ROLE_KEY',
])

export type SupabaseEnvFieldStatus = 'missing' | 'placeholder' | 'invalid' | 'set'

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const raw = process.env[name]?.trim()
    if (raw) return raw.replace(/^["']|["']$/g, '')
  }
  return undefined
}

/** Vercel ↔ Supabase integration may use different variable names than .env.example */
function resolveSupabaseUrl(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
}

function resolveSupabaseAnonKey(): string | undefined {
  return readEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
    'SUPABASE_ANON_KEY',
  )
}

function resolveServiceRoleKey(): string | undefined {
  return readEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_KEY',
  )
}

/** Strip paths/quotes so the client does not call invalid Supabase API URLs */
export function normalizeSupabaseUrl(raw: string): string {
  let url = raw.trim().replace(/^["']|["']$/g, '')

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }

  url = url.replace(/\/+$/, '')
  url = url.replace(/\/(rest\/v1|auth\/v1|storage\/v1)$/, '')

  return url
}

function urlStatusFromResolved(url: string | undefined): SupabaseEnvFieldStatus {
  if (!url) return 'missing'
  if (PLACEHOLDER_VALUES.has(url) || url.includes('YOUR_PROJECT')) return 'placeholder'

  try {
    const normalized = normalizeSupabaseUrl(url)
    const parsed = new URL(normalized)
    if (!parsed.hostname.endsWith('.supabase.co')) return 'invalid'
    return 'set'
  } catch {
    return 'invalid'
  }
}

function keyStatusFromResolved(key: string | undefined): SupabaseEnvFieldStatus {
  if (!key) return 'missing'
  if (PLACEHOLDER_VALUES.has(key)) return 'placeholder'
  return 'set'
}

export function getSupabaseUrlStatus(): SupabaseEnvFieldStatus {
  return urlStatusFromResolved(resolveSupabaseUrl())
}

export function getSupabaseAnonKeyStatus(): SupabaseEnvFieldStatus {
  return keyStatusFromResolved(resolveSupabaseAnonKey())
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseUrlStatus() === 'set' && getSupabaseAnonKeyStatus() === 'set'
}

export function getSupabaseEnv() {
  const rawUrl = resolveSupabaseUrl()
  const key = resolveSupabaseAnonKey()

  if (!isSupabaseConfigured() || !rawUrl || !key) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the Vercel integration) in Vercel → Environment Variables, then redeploy.',
    )
  }

  return { url: normalizeSupabaseUrl(rawUrl), key }
}

export function getServiceRoleKey(): string {
  const key = resolveServiceRoleKey()

  if (!key || PLACEHOLDER_VALUES.has(key)) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. Open Supabase Dashboard → Project Settings → API, copy the Secret key (sb_secret_...) or legacy service_role JWT, paste it into Vercel env vars, then redeploy.',
    )
  }

  return key
}
