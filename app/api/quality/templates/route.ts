import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { qualityMissingTableMessage } from '@/lib/quality/db'
import { fetchAllTemplates, fetchPublishedTemplates } from '@/lib/quality/queries'
import type { UserRole } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = (profile?.role ?? null) as UserRole | null
  if (!role || role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const templates =
      role === 'admin' ? await fetchAllTemplates(supabase) : await fetchPublishedTemplates(supabase)
    return NextResponse.json({ templates })
  } catch (error) {
    const message = qualityMissingTableMessage(error) ?? getSupabaseErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
