import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { qualityMissingTableMessage } from '@/lib/quality/db'
import { fetchInspectionDetail } from '@/lib/quality/queries'
import type { UserRole } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
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
    const inspection = await fetchInspectionDetail(supabase, id)
    if (!inspection) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ inspection })
  } catch (error) {
    const message = qualityMissingTableMessage(error) ?? getSupabaseErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
