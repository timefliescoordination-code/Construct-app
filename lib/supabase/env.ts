const PLACEHOLDER_VALUES = new Set([
  'your-anon-key',
  'your-service-role-key',
  'https://YOUR_PROJECT_REF.supabase.co',
  'REPLACE_WITH_PUBLISHABLE_OR_ANON_KEY',
  'REPLACE_WITH_SECRET_OR_SERVICE_ROLE_KEY',
])

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !key) return false
  if (PLACEHOLDER_VALUES.has(url) || PLACEHOLDER_VALUES.has(key)) return false
  if (url.includes('YOUR_PROJECT')) return false

  return true
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!isSupabaseConfigured() || !url || !key) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and add your project URL and anon key from https://supabase.com/dashboard/project/_/settings/api',
    )
  }

  return { url, key }
}

export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!key || PLACEHOLDER_VALUES.has(key)) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. Open Supabase Dashboard → Project Settings → API, copy the Secret key (sb_secret_...) or legacy service_role JWT, paste it into .env.local, then restart the dev server.',
    )
  }

  return key
}
