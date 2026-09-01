import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { qualityMissingTableMessage } from '@/lib/quality/db'
import { fetchInspections, summarizeInspections } from '@/lib/quality/queries'
import type { UserRole } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

  const projectId = request.nextUrl.searchParams.get('projectId') ?? undefined
  const mine = request.nextUrl.searchParams.get('mine') === '1'

  try {
    const inspections = await fetchInspections(supabase, {
      projectId,
      startedBy: mine || role === 'engineer' ? user.id : undefined,
    })
    return NextResponse.json({
      inspections,
      summary: summarizeInspections(inspections),
    })
  } catch (error) {
    const message = qualityMissingTableMessage(error) ?? getSupabaseErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
