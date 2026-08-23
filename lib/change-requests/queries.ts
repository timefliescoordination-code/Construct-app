import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConstructionChangeRequestDetail,
  UserRole,
} from '@/lib/types/database'

const REQUEST_SELECT = `
  *,
  related_milestone:milestones!construction_change_requests_related_milestone_id_fkey(id, name),
  affected_milestone:milestones!construction_change_requests_affected_milestone_id_fkey(id, name),
  project:projects(id, name, customer_id, pm_id),
  customer:profiles!construction_change_requests_customer_id_fkey(id, full_name, email)
`

export async function fetchChangeRequestDetail(
  supabase: SupabaseClient,
  requestId: string,
  role: UserRole,
): Promise<ConstructionChangeRequestDetail | null> {
  const { data: request, error } = await supabase
    .from('construction_change_requests')
    .select(REQUEST_SELECT)
    .eq('id', requestId)
    .maybeSingle()

  if (error || !request) return null

  const { data: attachments } = await supabase
    .from('construction_change_request_attachments')
    .select('*')
    .eq('change_request_id', requestId)
    .order('created_at', { ascending: true })

  const visibleAttachments =
    role === 'customer'
      ? (attachments ?? []).filter((a) => a.visibility === 'customer')
      : attachments ?? []

  const { data: revisions } = await supabase
    .from('construction_change_costing_revisions')
    .select('*, author:profiles!construction_change_costing_revisions_author_id_fkey(id, full_name)')
    .eq('change_request_id', requestId)
    .order('revision_number', { ascending: true })

  const revisionIds = (revisions ?? []).map((r) => r.id)
  let rows: Array<{
    id: string
    revision_id: string
    line_order: number
    description: string
    unit: string
    price: number
  }> = []

  if (revisionIds.length > 0) {
    const { data: rowData } = await supabase
      .from('construction_change_costing_rows')
      .select('*')
      .in('revision_id', revisionIds)
      .order('line_order', { ascending: true })
    rows = rowData ?? []
  }

  const revisionsWithRows = (revisions ?? []).map((rev) => ({
    ...rev,
    rows: rows.filter((row) => row.revision_id === rev.id),
  }))

  const { data: auditEvents } = await supabase
    .from('construction_change_audit_events')
    .select('*, actor:profiles!construction_change_audit_events_actor_id_fkey(id, full_name)')
    .eq('change_request_id', requestId)
    .order('created_at', { ascending: true })

  const visibleAudit =
    role === 'customer'
      ? (auditEvents ?? []).filter((e) =>
          ['status_change', 'customer_accept', 'customer_reject'].includes(e.event_type),
        )
      : auditEvents ?? []

  const { data: decisions } = await supabase
    .from('construction_change_customer_decisions')
    .select('*')
    .eq('change_request_id', requestId)
    .order('created_at', { ascending: false })

  const activeRevision = revisionsWithRows.find(
    (r) => r.id === request.active_costing_revision_id,
  )

  const sanitized =
    role === 'customer'
      ? {
          ...request,
          internal_notes: null,
        }
      : request

  return {
    ...sanitized,
    attachments: visibleAttachments,
    costing_revisions:
      role === 'customer'
        ? revisionsWithRows.filter((r) =>
            ['customer_approval_pending', 'approved', 'scheduled', 'in_progress', 'completed'].includes(
              request.status,
            ),
          )
        : revisionsWithRows,
    audit_events: visibleAudit,
    customer_decisions: decisions ?? [],
    active_revision: activeRevision ?? null,
  } as ConstructionChangeRequestDetail
}

export async function fetchChangeRequestsForProject(
  supabase: SupabaseClient,
  projectId: string,
) {
  const { data, error } = await supabase
    .from('construction_change_requests')
    .select(
      `
      id, request_number, title, category, status, created_at, submitted_at,
      estimated_additional_days, active_costing_revision_id,
      active_costing_revision:construction_change_costing_revisions!construction_change_requests_active_revision_fkey(total_price)
    `,
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchChangeRequestFinancialSummary(
  supabase: SupabaseClient,
  projectId: string,
) {
  const rows = await fetchChangeRequestsForProject(supabase, projectId)
  return rows
}

export async function fetchStaffChangeRequestDashboard(
  supabase: SupabaseClient,
  filters?: {
    status?: string
    projectId?: string
    category?: string
  },
) {
  let query = supabase
    .from('construction_change_requests')
    .select(
      `
      id, request_number, title, category, status, created_at, submitted_at,
      estimated_additional_days, project_id,
      active_costing_revision:construction_change_costing_revisions!construction_change_requests_active_revision_fkey(total_price),
      project:projects(id, name, pm_id),
      customer:profiles!construction_change_requests_customer_id_fkey(id, full_name)
    `,
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.projectId) query = query.eq('project_id', filters.projectId)
  if (filters?.category) query = query.eq('category', filters.category)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
