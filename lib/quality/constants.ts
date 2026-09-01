export const QUALITY_INSPECTION_PHOTOS_BUCKET = 'quality-inspection-photos'

export const QUALITY_PHOTO_UPLOAD_CONFIG = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFileSizeMB: 10,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'] as const,
  maxFilesPerBatch: 8,
}

export const QUALITY_WORK_TYPES = [
  { value: 'brickwork', label: 'Brickwork' },
  { value: 'rcc', label: 'RCC' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'column', label: 'Column' },
  { value: 'beam', label: 'Beam' },
  { value: 'slab', label: 'Slab' },
  { value: 'plastering', label: 'Plastering' },
  { value: 'waterproofing', label: 'Waterproofing' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'tiling', label: 'Tiling' },
  { value: 'painting', label: 'Painting' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'doors_windows', label: 'Doors / windows' },
  { value: 'external_works', label: 'External works' },
  { value: 'other', label: 'Other' },
] as const

export type QualityWorkType = (typeof QUALITY_WORK_TYPES)[number]['value']

export const QUALITY_PARAMETER_TYPES = [
  'numeric',
  'ratio',
  'text',
  'single_select',
  'multi_select',
  'boolean',
  'measurement',
] as const

export type QualityParameterType = (typeof QUALITY_PARAMETER_TYPES)[number]

export const QUALITY_UNITS = [
  'mm',
  'cm',
  'm',
  'm²',
  'm³',
  'kg',
  '%',
  'days',
  'level',
  'ratio',
] as const

export type QualityUnit = (typeof QUALITY_UNITS)[number]

export const QUALITY_ITEM_STATUSES = ['pass', 'fail', 'na', 'not_checked'] as const
export type QualityItemStatus = (typeof QUALITY_ITEM_STATUSES)[number]

export const QUALITY_ITEM_STATUS_LABELS: Record<QualityItemStatus, string> = {
  pass: 'PASS',
  fail: 'FAIL',
  na: 'N/A',
  not_checked: 'NOT CHECKED',
}

export const QUALITY_INSPECTION_STATUSES = [
  'draft',
  'in_progress',
  'submitted',
  'failed',
  'awaiting_correction',
  'ready_for_reinspection',
  'approved',
  'rejected',
  'closed',
] as const

export type QualityInspectionStatus = (typeof QUALITY_INSPECTION_STATUSES)[number]

export const QUALITY_INSPECTION_STATUS_LABELS: Record<QualityInspectionStatus, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  submitted: 'Submitted',
  failed: 'Failed',
  awaiting_correction: 'Awaiting correction',
  ready_for_reinspection: 'Ready for reinspection',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
}

export const QUALITY_APPROVAL_STATUSES = [
  'not_required',
  'pending',
  'failed',
  'awaiting_correction',
  'ready_for_approval',
  'approved',
] as const

export type QualityApprovalStatus = (typeof QUALITY_APPROVAL_STATUSES)[number]

export const QUALITY_APPROVAL_STATUS_LABELS: Record<QualityApprovalStatus, string> = {
  not_required: 'Not required',
  pending: 'Pending',
  failed: 'Failed',
  awaiting_correction: 'Awaiting correction',
  ready_for_approval: 'Ready for approval',
  approved: 'Approved',
}

export const QUALITY_CORRECTIVE_STATUSES = [
  'open',
  'in_progress',
  'ready_for_reinspection',
  'closed',
] as const

export type QualityCorrectiveStatus = (typeof QUALITY_CORRECTIVE_STATUSES)[number]

export const QUALITY_CORRECTIVE_STATUS_LABELS: Record<QualityCorrectiveStatus, string> = {
  open: 'Open',
  in_progress: 'Correction in progress',
  ready_for_reinspection: 'Ready for reinspection',
  closed: 'Closed',
}

export const QUALITY_PHOTO_LEVELS = ['inspection', 'item', 'failure'] as const
export type QualityPhotoLevel = (typeof QUALITY_PHOTO_LEVELS)[number]

export const QUALITY_APPROVAL_DECISIONS = ['approved', 'rejected', 'request_correction'] as const
export type QualityApprovalDecision = (typeof QUALITY_APPROVAL_DECISIONS)[number]

export const QUALITY_LOCKED_STATUSES: QualityInspectionStatus[] = [
  'approved',
  'rejected',
  'closed',
]

export const QUALITY_ENGINEER_EDITABLE_STATUSES: QualityInspectionStatus[] = [
  'draft',
  'in_progress',
  'failed',
  'awaiting_correction',
  'ready_for_reinspection',
]

export const QUALITY_PM_REVIEW_STATUSES: QualityInspectionStatus[] = [
  'submitted',
  'failed',
  'awaiting_correction',
  'ready_for_reinspection',
  'rejected',
]

export const QUALITY_MIGRATIONS_HINT =
  'Quality checklist tables are missing. In Supabase SQL Editor, run supabase/quality-checklists-module.sql (paste the full file), then refresh this page.'
