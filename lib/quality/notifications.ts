import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { isServiceRoleConfigured } from '@/lib/supabase/env'
import { inspectionStaffLink } from '@/lib/quality/workflow'

export async function notifyStaffOnQualityInspectionSubmitted(
  input: {
    projectId: string
    projectName: string
    inspectionId: string
    inspectionNumber: number
    workLabel: string
  },
): Promise<void> {
  if (!isServiceRoleConfigured()) return
  const adminClient = createAdminClient()

  const { data: project } = await adminClient
    .from('projects')
    .select('pm_id, name')
    .eq('id', input.projectId)
    .maybeSingle()

  const { data: admins } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  const recipientIds = new Set<string>()
  if (project?.pm_id) recipientIds.add(project.pm_id)
  for (const row of admins ?? []) {
    if (row.id) recipientIds.add(row.id)
  }
  if (recipientIds.size === 0) return

  const title = 'Quality inspection submitted'
  const message = `${input.projectName}: ${input.workLabel} inspection #${input.inspectionNumber} is ready for review.`
  const linkPath = inspectionStaffLink(input.inspectionId)

  const rows = [...recipientIds].map((userId) => ({
    user_id: userId,
    title,
    message,
    type: 'quality_inspection',
    project_id: input.projectId,
    reference_id: input.inspectionId,
    link_path: linkPath,
    dedupe_key: `quality-submitted-${input.inspectionId}`,
    expense_id: null,
  }))

  const { error } = await adminClient
    .from('notifications')
    .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })

  if (error) {
    console.error('[quality] staff notify failed:', error.message)
  }
}

export async function notifyEngineerOnQualityDecision(
  supabase: SupabaseClient,
  input: {
    projectId: string
    inspectionId: string
    engineerId: string | null
    decision: string
    inspectionNumber: number
  },
): Promise<void> {
  if (!input.engineerId) return
  const title =
    input.decision === 'approved'
      ? 'Inspection approved'
      : input.decision === 'rejected'
        ? 'Inspection rejected'
        : 'Correction requested'
  const { error } = await supabase.from('notifications').upsert(
    {
      user_id: input.engineerId,
      title,
      message: `Inspection #${input.inspectionNumber} was ${input.decision.replaceAll('_', ' ')}.`,
      type: 'quality_inspection',
      project_id: input.projectId,
      reference_id: input.inspectionId,
      link_path: inspectionStaffLink(input.inspectionId),
      dedupe_key: `quality-decision-${input.inspectionId}-${input.decision}`,
      expense_id: null,
    },
    { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
  )
  if (error) {
    console.error('[quality] engineer notify failed:', error.message)
  }
}
