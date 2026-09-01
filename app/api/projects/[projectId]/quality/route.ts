import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { qualityMissingTableMessage } from '@/lib/quality/db'
import {
  fetchInspections,
  fetchProjectChecklists,
  fetchProjectOverrides,
  fetchPublishedTemplates,
  fetchTemplateDetail,
  summarizeInspections,
} from '@/lib/quality/queries'
import type { UserRole } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ projectId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params
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

  const templateId = request.nextUrl.searchParams.get('templateId')

  try {
    const [inspections, assignments, overrides, templates] = await Promise.all([
      fetchInspections(supabase, { projectId }),
      fetchProjectChecklists(supabase, projectId),
      fetchProjectOverrides(supabase, projectId),
      fetchPublishedTemplates(supabase),
    ])
    const templateDetail = templateId ? await fetchTemplateDetail(supabase, templateId) : null
    return NextResponse.json({
      inspections,
      summary: summarizeInspections(inspections),
      assignments,
      overrides,
      templates,
      templateDetail,
    })
  } catch (error) {
    const message = qualityMissingTableMessage(error) ?? getSupabaseErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
