export const PROPOSAL_METHODS = ['sqft', 'boq'] as const
export type ProposalMethod = (typeof PROPOSAL_METHODS)[number]

export const PROPOSAL_STATUSES = [
  'draft',
  'shared',
  'viewed',
  'revision_requested',
  'revision_created',
  'accepted',
  'withdrawn',
  'expired',
  'archived',
] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_VERSION_STATUSES = [
  'draft',
  'shared',
  'viewed',
  'revision_requested',
  'superseded',
  'accepted',
  'withdrawn',
  'expired',
] as const
export type ProposalVersionStatus = (typeof PROPOSAL_VERSION_STATUSES)[number]

export const PROPOSAL_ITEM_SECTIONS = ['built_up', 'additional', 'boq'] as const
export type ProposalItemSection = (typeof PROPOSAL_ITEM_SECTIONS)[number]

export const REVISION_REQUEST_STATUSES = ['open', 'resolved', 'dismissed'] as const
export type RevisionRequestStatus = (typeof REVISION_REQUEST_STATUSES)[number]

export const PROPOSAL_AUDIT_EVENT_TYPES = [
  'created',
  'edited',
  'shared',
  'viewed',
  'revision_requested',
  'revision_created',
  'revision_shared',
  'withdrawn',
  'archived',
  'accepted',
] as const
export type ProposalAuditEventType = (typeof PROPOSAL_AUDIT_EVENT_TYPES)[number]

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  shared: 'Shared',
  viewed: 'Viewed',
  revision_requested: 'Revision requested',
  revision_created: 'Revision created',
  accepted: 'Accepted',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
  archived: 'Archived',
}

export const PROPOSAL_VERSION_STATUS_LABELS: Record<ProposalVersionStatus, string> = {
  draft: 'Draft',
  shared: 'Shared',
  viewed: 'Viewed',
  revision_requested: 'Revision requested',
  superseded: 'Superseded',
  accepted: 'Accepted',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
}

export const PROPOSAL_METHOD_LABELS: Record<ProposalMethod, string> = {
  sqft: 'Sqft Method',
  boq: 'BOQ Method',
}

export const PROPOSAL_UNITS = [
  'sqft',
  'r.ft',
  'nos',
  'kg',
  'MT',
  'm',
  'cu.ft',
  'item',
  'lot',
  'day',
] as const

export type ProposalUnit = (typeof PROPOSAL_UNITS)[number] | string

export const DEFAULT_PROPOSAL_NOTES = [
  'Rates are based on the specifications mentioned in this proposal.',
  'Any work not specifically mentioned will be treated as additional work.',
  'Changes requested after proposal submission may affect the final project cost.',
  'Final quantities may vary based on actual site requirements.',
].join('\n')

export const MAX_REVISION_REQUESTS_PER_HOUR = 8

export const MAX_CLIENT_MESSAGE_LENGTH = 4000

export function defaultUnitForSection(section: ProposalItemSection): string {
  if (section === 'boq') return 'item'
  return 'sqft'
}
