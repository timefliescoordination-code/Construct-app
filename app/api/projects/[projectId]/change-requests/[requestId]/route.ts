import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchChangeRequestDetail } from '@/lib/change-requests/queries'
import type { UserRole } from '@/lib/types/database'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; requestId: string }> },
) {
  const { requestId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile?.role ?? null) as UserRole | null
  if (!role) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }

  const detail = await fetchChangeRequestDetail(supabase, requestId, role)
  if (!detail) {
    return NextResponse.json({ error: 'Change request not found' }, { status: 404 })
  }

  return NextResponse.json({ request: detail })
}
