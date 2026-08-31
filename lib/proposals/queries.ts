import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProposalDetail, ProposalListRow, ProposalVersionWithItems } from '@/lib/proposals/types'
import type { ProposalStatus } from '@/lib/proposals/constants'

type ProfileName = { id: string; full_name: string }

async function mapProfiles(supabase: SupabaseClient, ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map<string, ProfileName>()
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique)
  return new Map((data ?? []).map((row) => [row.id, row as ProfileName]))
}

export async function listProposals(
  supabase: SupabaseClient,
  input?: { projectId?: string; status?: ProposalStatus | '' },
): Promise<{ data: ProposalListRow[]; error: string | null }> {
  let query = supabase
    .from('proposals')
    .select(
      `
      id, project_id, proposal_number, title, current_version_id, status, share_token,
      archived_at, created_by, created_at, updated_at,
      project:projects(id, name, client_name, site_address)
    `,
    )
    .order('updated_at', { ascending: false })

  if (input?.projectId) query = query.eq('project_id', input.projectId)
  if (input?.status) query = query.eq('status', input.status)
  else query = query.neq('status', 'archived')

  const { data, error } = await query
  if (error) return { data: [], error: error.message }

  const rows = (data ?? []) as unknown as ProposalListRow[]
  const versionIds = rows.map((row) => row.current_version_id).filter((id): id is string => Boolean(id))
  const profiles = await mapProfiles(supabase, rows.map((row) => row.created_by))

  const versionMap = new Map<string, ProposalListRow['current_version']>()
  if (versionIds.length > 0) {
    const { data: versions } = await supabase
      .from('proposal_versions')
      .select(
        'id, version_number, method, status, grand_total, shared_at, first_viewed_at, last_viewed_at, public_token',
      )
      .in('id', versionIds)
    for (const version of versions ?? []) {
      versionMap.set(version.id, version as ProposalListRow['current_version'])
    }
  }

  const ids = rows.map((row) => row.id)
  const counts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: openRequests } = await supabase
      .from('proposal_revision_requests')
      .select('proposal_id')
      .in('proposal_id', ids)
      .eq('status', 'open')
    for (const req of openRequests ?? []) {
      counts.set(req.proposal_id, (counts.get(req.proposal_id) ?? 0) + 1)
    }
  }

  return {
    data: rows.map((row) => ({
      ...row,
      created_by_profile: row.created_by ? profiles.get(row.created_by) ?? null : null,
      current_version: row.current_version_id ? versionMap.get(row.current_version_id) ?? null : null,
      open_revision_count: counts.get(row.id) ?? 0,
    })),
    error: null,
  }
}

export async function fetchProposalDetail(
  supabase: SupabaseClient,
  proposalId: string,
): Promise<ProposalDetail | null> {
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(
      `
      *,
      project:projects(id, name, client_name, site_address, client_phone, customer_id, pm_id)
    `,
    )
    .eq('id', proposalId)
    .maybeSingle()

  if (error || !proposal) return null

  const { data: versions } = await supabase
    .from('proposal_versions')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('version_number', { ascending: false })

  const versionIds = (versions ?? []).map((v) => v.id)
  let items: ProposalVersionWithItems['items'] = []
  if (versionIds.length > 0) {
    const { data: itemRows } = await supabase
      .from('proposal_items')
      .select('*')
      .in('proposal_version_id', versionIds)
      .order('sort_order', { ascending: true })
    items = (itemRows ?? []) as ProposalVersionWithItems['items']
  }

  const profiles = await mapProfiles(supabase, [
    proposal.created_by,
    ...(versions ?? []).map((v) => v.created_by),
  ])

  const versionsWithItems: ProposalVersionWithItems[] = (versions ?? []).map((version) => ({
    ...(version as ProposalVersionWithItems),
    items: items.filter((item) => item.proposal_version_id === version.id),
    created_by_profile: version.created_by ? profiles.get(version.created_by) ?? null : null,
  }))

  const { data: revisionRequests } = await supabase
    .from('proposal_revision_requests')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })

  const { data: auditEvents } = await supabase
    .from('proposal_audit_events')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })

  const auditProfiles = await mapProfiles(
    supabase,
    (auditEvents ?? []).map((event) => event.actor_id),
  )

  return {
    ...(proposal as ProposalDetail),
    created_by_profile: proposal.created_by ? profiles.get(proposal.created_by) ?? null : null,
    versions: versionsWithItems,
    revision_requests: revisionRequests ?? [],
    audit_events: (auditEvents ?? []).map((event) => ({
      ...event,
      actor: event.actor_id ? auditProfiles.get(event.actor_id) ?? null : null,
    })),
  }
}
