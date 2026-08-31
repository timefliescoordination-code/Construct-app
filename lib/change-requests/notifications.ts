import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { isServiceRoleConfigured } from '@/lib/supabase/env'
import { customerChangeRequestLink, staffChangeRequestLink } from '@/lib/change-requests/workflow'
import { notifyProjectCustomer } from '@/lib/notifications'

type StaffNotifyInput = {
  projectId: string
  projectName: string
  requestId: string
  requestTitle: string
  dedupeKey: string
}

/** Notify assigned engineer, PM, and all admins — deduped per event. */
export async function notifyStaffOnChangeRequestSubmitted(
  _supabase: SupabaseClient,
  input: StaffNotifyInput,
): Promise<void> {
  if (!isServiceRoleConfigured()) return
  const adminClient = createAdminClient()

  const { data: project } = await adminClient
    .from('projects')
    .select('pm_id, name')
    .eq('id', input.projectId)
    .maybeSingle()

  const { data: engineers } = await adminClient
    .from('project_engineers')
    .select('engineer_id')
    .eq('project_id', input.projectId)

  const { data: admins } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  const recipientIds = new Set<string>()
  if (project?.pm_id) recipientIds.add(project.pm_id)
  for (const row of engineers ?? []) {
    if (row.engineer_id) recipientIds.add(row.engineer_id)
  }
  for (const row of admins ?? []) {
    if (row.id) recipientIds.add(row.id)
  }

  if (recipientIds.size === 0) return

  const title = 'New customer change request'
  const message = `New customer change request: ${input.projectName} — ${input.requestTitle}`
  const linkPath = staffChangeRequestLink(input.requestId)

  const rows = [...recipientIds].map((userId) => ({
    user_id: userId,
    title,
    message,
    type: 'change_request',
    project_id: input.projectId,
    reference_id: input.requestId,
    link_path: linkPath,
    dedupe_key: input.dedupeKey,
    expense_id: null,
  }))

  const { error } = await adminClient
    .from('notifications')
    .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })

  if (error) {
    console.error('[change-requests] staff notify failed:', error.message)
  }
}

export async function notifyCustomerOnChangeRequestStatus(
  _supabase: SupabaseClient,
  input: {
    projectId: string
    requestId: string
    title: string
    statusLabel: string
    dedupeKey: string
  },
): Promise<void> {
  if (!isServiceRoleConfigured()) return
  const adminClient = createAdminClient()
  await notifyProjectCustomer(adminClient, {
    projectId: input.projectId,
    type: 'change_request',
    title: 'Change request update',
    message: `${input.title}: ${input.statusLabel}`,
    referenceId: input.requestId,
    linkPath: customerChangeRequestLink(input.requestId),
    dedupeKey: input.dedupeKey,
  })
}
