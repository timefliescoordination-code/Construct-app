import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnvForBrowser } from '@/lib/supabase/env'

export function createClient() {
  const { url, key } = getSupabaseEnvForBrowser()
  return createBrowserClient(url, key)
}
