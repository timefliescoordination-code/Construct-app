import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { isServiceRoleConfigured } from '@/lib/supabase/env'

export async function notifyStaffOnProposalRevision(
  input: {
    projectId: string | null
    createdBy?: string | null
    proposalId: string
    proposalNumber: string
    versionNumber: number
    messagePreview: string
    dedupeKey: string
  },
): Promise<void> {
  if (!isServiceRoleConfigured()) return
  const adminClient = createAdminClient()

  let project: { pm_id: string | null; name: string } | null = null
  if (input.projectId) {
    const { data } = await adminClient
      .from('projects')
      .select('pm_id, name')
      .eq('id', input.projectId)
      .maybeSingle()
    project = data
  }

  const { data: admins } = await adminClient.from('profiles').select('id').eq('role', 'admin')

  const recipientIds = new Set<string>()
  if (project?.pm_id) recipientIds.add(project.pm_id)
  if (input.createdBy) recipientIds.add(input.createdBy)
  for (const row of admins ?? []) {
    if (row.id) recipientIds.add(row.id)
  }

  if (recipientIds.size === 0) return

  const title = 'Proposal revision requested'
  const message = `${input.proposalNumber} (v${input.versionNumber}) — ${input.messagePreview}`
  const linkPath = `/proposals/${input.proposalId}`

  const rows = [...recipientIds].map((userId) => ({
    user_id: userId,
    title,
    message,
    type: 'proposal',
    project_id: input.projectId,
    reference_id: input.proposalId,
    link_path: linkPath,
    dedupe_key: input.dedupeKey,
    expense_id: null,
  }))

  const { error } = await adminClient
    .from('notifications')
    .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })

  if (error) {
    console.error('[proposals] staff notify failed:', error.message)
  }
}

export async function recordProposalAudit(
  supabase: SupabaseClient,
  input: {
    proposalId: string
    proposalVersionId?: string | null
    eventType:
      | 'created'
      | 'edited'
      | 'shared'
      | 'viewed'
      | 'revision_requested'
      | 'revision_created'
      | 'revision_shared'
      | 'withdrawn'
      | 'archived'
      | 'accepted'
      | 'converted_to_project'
    actorId?: string | null
    actorRole?: string | null
    metadata?: Record<string, unknown> | null
  },
): Promise<void> {
  const { error } = await supabase.from('proposal_audit_events').insert({
    proposal_id: input.proposalId,
    proposal_version_id: input.proposalVersionId ?? null,
    event_type: input.eventType,
    actor_id: input.actorId ?? null,
    actor_role: input.actorRole ?? null,
    metadata: input.metadata ?? null,
  })

  if (error) {
    console.error('[proposals] audit insert failed:', error.message)
  }
}
