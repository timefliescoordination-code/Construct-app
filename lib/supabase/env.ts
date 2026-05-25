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

/** Browser / client bundle — only NEXT_PUBLIC_* (inlined at build time on Vercel) */
function resolveSupabaseUrlForBrowser(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL')
}

function resolveSupabaseAnonKeyForBrowser(): string | undefined {
  return readEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
  )
}

/** Server / middleware — Vercel integration may sync non-public names */
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

/** Status for login/signup in the browser — must use NEXT_PUBLIC_* */
export function getBrowserSupabaseUrlStatus(): SupabaseEnvFieldStatus {
  return urlStatusFromResolved(resolveSupabaseUrlForBrowser())
}

export function getBrowserSupabaseAnonKeyStatus(): SupabaseEnvFieldStatus {
  return keyStatusFromResolved(resolveSupabaseAnonKeyForBrowser())
}

export function isSupabaseConfiguredForBrowser(): boolean {
  return (
    getBrowserSupabaseUrlStatus() === 'set' && getBrowserSupabaseAnonKeyStatus() === 'set'
  )
}

/** Server-side (includes integration-only SUPABASE_* names) */
export function getSupabaseUrlStatus(): SupabaseEnvFieldStatus {
  return urlStatusFromResolved(resolveSupabaseUrl())
}

export function getSupabaseAnonKeyStatus(): SupabaseEnvFieldStatus {
  return keyStatusFromResolved(resolveSupabaseAnonKey())
}

/** Server / middleware — accepts integration vars like SUPABASE_ANON_KEY */
export function isSupabaseConfigured(): boolean {
  return (
    urlStatusFromResolved(resolveSupabaseUrl()) === 'set' &&
    keyStatusFromResolved(resolveSupabaseAnonKey()) === 'set'
  )
}

export function getSupabaseEnvForBrowser() {
  const rawUrl = resolveSupabaseUrlForBrowser()
  const key = resolveSupabaseAnonKeyForBrowser()

  if (!isSupabaseConfiguredForBrowser() || !rawUrl || !key) {
    const hasServerOnlyKey =
      Boolean(process.env.SUPABASE_ANON_KEY?.trim()) &&
      !resolveSupabaseAnonKeyForBrowser()

    throw new Error(
      hasServerOnlyKey
        ? 'Supabase keys exist as SUPABASE_ANON_KEY but login needs NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in Vercel, then redeploy.'
        : 'Supabase is not configured for the browser. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Environment Variables, then redeploy.',
    )
  }

  return { url: normalizeSupabaseUrl(rawUrl), key }
}

export function getSupabaseEnv() {
  const rawUrl = resolveSupabaseUrl()
  const key = resolveSupabaseAnonKey()

  if (
    urlStatusFromResolved(rawUrl) !== 'set' ||
    keyStatusFromResolved(key) !== 'set' ||
    !rawUrl ||
    !key
  ) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Environment Variables, then redeploy.',
    )
  }

  return { url: normalizeSupabaseUrl(rawUrl), key }
}

export function getSupabaseEnvDiagnostics(): {
  browser: {
    urlCandidates: { name: string; present: boolean }[]
    keyCandidates: { name: string; present: boolean }[]
  }
  serverOnly: {
    urlCandidates: { name: string; present: boolean }[]
    keyCandidates: { name: string; present: boolean }[]
  }
} {
  const map = (names: readonly string[]) =>
    names.map((name) => ({
      name,
      present: Boolean(process.env[name]?.trim()),
    }))

  return {
    browser: {
      urlCandidates: map(['NEXT_PUBLIC_SUPABASE_URL'] as const),
      keyCandidates: map([
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
      ] as const),
    },
    serverOnly: {
      urlCandidates: map(['SUPABASE_URL'] as const),
      keyCandidates: map(['SUPABASE_ANON_KEY'] as const),
    },
  }
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
