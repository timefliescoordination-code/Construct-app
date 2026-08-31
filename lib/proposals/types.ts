import type {
  ProposalAuditEventType,
  ProposalItemSection,
  ProposalMethod,
  ProposalStatus,
  ProposalVersionStatus,
  RevisionRequestStatus,
} from '@/lib/proposals/constants'

export type ProposalItemDraft = {
  id?: string
  section: ProposalItemSection
  description: string
  quantity: string
  unit: string
  rate: string
}

export type ProposalItemRow = {
  id: string
  proposal_version_id: string
  section: ProposalItemSection
  sort_order: number
  description: string
  quantity: number
  unit: string
  rate: number
  price: number
}

export type ProposalVersionRow = {
  id: string
  proposal_id: string
  version_number: number
  method: ProposalMethod
  status: ProposalVersionStatus
  title: string
  proposal_date: string
  valid_until: string | null
  notes: string
  built_up_total: number
  additional_works_total: number
  grand_total: number
  snapshot_project_name: string
  snapshot_client_name: string
  snapshot_project_address: string
  snapshot_client_phone: string | null
  snapshot_client_email: string | null
  public_token: string | null
  shared_at: string | null
  first_viewed_at: string | null
  last_viewed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ProposalRow = {
  id: string
  project_id: string
  proposal_number: string
  title: string
  current_version_id: string | null
  status: ProposalStatus
  share_token: string | null
  archived_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ProposalRevisionRequestRow = {
  id: string
  proposal_id: string
  proposal_version_id: string
  client_message: string
  status: RevisionRequestStatus
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

export type ProposalAuditEventRow = {
  id: string
  proposal_id: string
  proposal_version_id: string | null
  event_type: ProposalAuditEventType
  actor_id: string | null
  actor_role: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type ProposalVersionWithItems = ProposalVersionRow & {
  items: ProposalItemRow[]
  created_by_profile?: { id: string; full_name: string } | null
}

export type ProposalListRow = ProposalRow & {
  project?: { id: string; name: string; client_name: string; site_address: string } | null
  created_by_profile?: { id: string; full_name: string } | null
  current_version?: Pick<
    ProposalVersionRow,
    | 'id'
    | 'version_number'
    | 'method'
    | 'status'
    | 'grand_total'
    | 'shared_at'
    | 'first_viewed_at'
    | 'last_viewed_at'
    | 'public_token'
  > | null
  open_revision_count?: number
}

export type ProposalDetail = ProposalRow & {
  project?: {
    id: string
    name: string
    client_name: string
    site_address: string
    client_phone: string | null
    customer_id: string | null
    pm_id: string | null
  } | null
  created_by_profile?: { id: string; full_name: string } | null
  versions: ProposalVersionWithItems[]
  revision_requests: ProposalRevisionRequestRow[]
  audit_events: Array<ProposalAuditEventRow & { actor?: { id: string; full_name: string } | null }>
}

export type PublicProposalItem = {
  sort_order: number
  section: ProposalItemSection
  description: string
  quantity: number
  unit: string
  rate: number
  price: number
}

export type PublicProposalDocument = {
  proposal_number: string
  title: string
  version_number: number
  method: ProposalMethod
  proposal_date: string
  valid_until: string | null
  project_name: string
  project_address: string
  client_name: string
  notes: string
  items: PublicProposalItem[]
  built_up_total: number
  additional_works_total: number
  grand_total: number
  company: {
    company_name: string | null
    phone: string | null
    email: string | null
    address: string | null
    logo_url: string | null
  }
}

export type PublicProposalAvailability = 'ok' | 'unavailable' | 'withdrawn' | 'expired'

export type PublicProposalResponse = {
  availability: PublicProposalAvailability
  is_historical: boolean
  newer_available: boolean
  current_share_path: string | null
  can_request_revision: boolean
  document: PublicProposalDocument | null
}

export type ProposalEditorPayload = {
  projectId: string
  title: string
  proposalDate: string
  validUntil: string | null
  method: ProposalMethod
  notes: string
  items: Array<{
    section: ProposalItemSection
    description: string
    quantity: number
    unit: string
    rate: number
  }>
}
