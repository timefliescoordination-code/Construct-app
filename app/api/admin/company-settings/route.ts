import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin'
import { getCompanySettings } from '@/lib/company/settings'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  const auth = await requireAdminApi()
  if ('error' in auth && auth.error) return auth.error

  const { data, error } = await getCompanySettings(auth.supabase!)
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ data })
}
