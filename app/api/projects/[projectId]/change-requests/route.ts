import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchChangeRequestsForProject } from '@/lib/change-requests/queries'
import type { UserRole } from '@/lib/types/database'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params
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

  try {
    const requests = await fetchChangeRequestsForProject(supabase, projectId)
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('[change-requests GET]', error)
    return NextResponse.json({ error: 'Failed to load change requests' }, { status: 500 })
  }
}
