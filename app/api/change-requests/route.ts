import { NextRequest, NextResponse } from 'next/server'
import { summarizeChangeRequestFinancials } from '@/lib/change-requests/calculations'
import { createClient } from '@/lib/supabase/server'
import { fetchStaffChangeRequestDashboard } from '@/lib/change-requests/queries'
import type { UserRole } from '@/lib/types/database'

export async function GET(request: NextRequest) {
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
  if (!role || role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const status = request.nextUrl.searchParams.get('status') ?? undefined
  const projectId = request.nextUrl.searchParams.get('projectId') ?? undefined
  const category = request.nextUrl.searchParams.get('category') ?? undefined

  try {
    const requests = await fetchStaffChangeRequestDashboard(supabase, {
      status,
      projectId,
      category,
    })
    const summary = summarizeChangeRequestFinancials(requests)
    return NextResponse.json({ requests, summary })
  } catch (error) {
    console.error('[change-requests dashboard GET]', error)
    return NextResponse.json({ error: 'Failed to load change requests' }, { status: 500 })
  }
}
