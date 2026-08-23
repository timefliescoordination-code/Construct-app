export const CONSTRUCTION_CHANGE_FILES_BUCKET = 'construction-change-files'

export const CHANGE_REQUEST_CATEGORIES = [
  { value: 'design', label: 'Design' },
  { value: 'material', label: 'Material' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'civil_work', label: 'Civil work' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'other', label: 'Other' },
] as const

export type ChangeRequestCategory = (typeof CHANGE_REQUEST_CATEGORIES)[number]['value']

export const CHANGE_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'costing_prepared',
  'internal_approval_pending',
  'customer_approval_pending',
  'approved',
  'scheduled',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
] as const

export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number]

export const CHANGE_REQUEST_STATUS_LABELS: Record<ChangeRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  costing_prepared: 'Costing prepared',
  internal_approval_pending: 'Internal approval pending',
  customer_approval_pending: 'Customer approval pending',
  approved: 'Approved',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const CUSTOMER_EDITABLE_STATUSES: ChangeRequestStatus[] = ['draft', 'submitted']

export const STAFF_ACTION_STATUSES: ChangeRequestStatus[] = [
  'submitted',
  'under_review',
  'costing_prepared',
  'internal_approval_pending',
  'customer_approval_pending',
  'approved',
  'scheduled',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
]

export const COSTING_UNIT_SUGGESTIONS = [
  'sqft',
  'rft',
  'length × breadth',
  'number',
  'item',
  'lump sum',
  'other',
] as const

export const CHANGE_REQUEST_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024

export const CHANGE_REQUEST_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const
