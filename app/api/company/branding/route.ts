import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getCompanyBranding } from '@/lib/company/settings'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { data: { company_name: null, logo_url: null } },
      { status: 200 },
    )
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const reader = user ? supabase : createAdminClient()
    const branding = await getCompanyBranding(reader)

    return NextResponse.json({ data: branding })
  } catch {
    return NextResponse.json(
      { data: { company_name: null, logo_url: null } },
      { status: 200 },
    )
  }
}
