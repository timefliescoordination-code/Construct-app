import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchProposalDetail } from '@/lib/proposals/queries'
import { canManageProposals } from '@/lib/proposals/access'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import type { UserRole } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 })
  }

  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canManageProposals((profile?.role ?? null) as UserRole | null)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const detail = await fetchProposalDetail(supabase, id)
  if (!detail) {
    return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 })
  }

  return NextResponse.json({ data: detail })
}
