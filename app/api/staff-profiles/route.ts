import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone, company_name, created_at, updated_at')
      .in('role', ['pm', 'engineer', 'customer'])
      .order('full_name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: getSupabaseErrorMessage(error) }, { status: 400 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[api/staff-profiles]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load staff' },
      { status: 500 },
    )
  }
}
