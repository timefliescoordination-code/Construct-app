import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listProposals } from '@/lib/proposals/queries'
import { canManageProposals } from '@/lib/proposals/access'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import type { UserRole } from '@/lib/types/database'
import type { ProposalStatus } from '@/lib/proposals/constants'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 503 })
  }

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

  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId') || undefined
  const status = (url.searchParams.get('status') || '') as ProposalStatus | ''

  const { data, error } = await listProposals(supabase, { projectId, status })
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ data })
}
