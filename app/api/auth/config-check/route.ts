import { NextResponse } from 'next/server'
import {
  getBrowserSupabaseAnonKeyStatus,
  getBrowserSupabaseUrlStatus,
  isSupabaseConfigured,
  isSupabaseConfiguredForBrowser,
} from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

/** Lightweight diagnostics for login issues (no secrets exposed). */
export async function GET() {
  const browserUrl = getBrowserSupabaseUrlStatus()
  const browserKey = getBrowserSupabaseAnonKeyStatus()

  return NextResponse.json({
    serverConfigured: isSupabaseConfigured(),
    browserConfigured: isSupabaseConfiguredForBrowser(),
    browserUrl,
    browserKey,
    hasPublicUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    hasPublicAnonKey: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
    ),
    hint:
      browserUrl === 'set' && browserKey === 'set'
        ? 'Browser bundle has Supabase keys. Client login can work after redeploy.'
        : 'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in hPanel before build, then redeploy. API login still works if server keys are set.',
  })
}
