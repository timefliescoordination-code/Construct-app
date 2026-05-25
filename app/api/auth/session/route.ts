import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ user: null, profile: null })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user: null, profile: null })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, company_name')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({ user: { id: user.id, email: user.email }, profile })
  } catch (error) {
    console.error('[api/auth/session]', error)
    return NextResponse.json(
      { user: null, profile: null, error: 'session_unavailable' },
      { status: 500 },
    )
  }
}
