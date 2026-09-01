import {
  QUALITY_LOCKED_STATUSES,
  type QualityInspectionStatus,
  type QualityItemStatus,
} from './constants'

export type InspectionItemForStatus = {
  status: QualityItemStatus
  is_critical: boolean
  is_required: boolean
  allow_na: boolean
}

export type CorrectiveActionForStatus = {
  status: 'open' | 'in_progress' | 'ready_for_reinspection' | 'closed'
}

export function isInspectionLocked(status: QualityInspectionStatus): boolean {
  return QUALITY_LOCKED_STATUSES.includes(status)
}

export function itemBlocksApproval(item: InspectionItemForStatus): boolean {
  if (item.status === 'fail' && item.is_critical) return true
  return false
}

export function hasBlockingCriticalFailure(items: InspectionItemForStatus[]): boolean {
  return items.some(itemBlocksApproval)
}

export function uncheckedRequiredItems(items: InspectionItemForStatus[]): InspectionItemForStatus[] {
  return items.filter((item) => item.is_required && item.status === 'not_checked')
}

export function failedItems(items: InspectionItemForStatus[]): InspectionItemForStatus[] {
  return items.filter((item) => item.status === 'fail')
}

export function deriveInspectionStatus(input: {
  items: InspectionItemForStatus[]
  correctiveActions: CorrectiveActionForStatus[]
  currentStatus: QualityInspectionStatus
  intent: 'save' | 'submit' | 'ready_for_reinspection'
}): QualityInspectionStatus {
  if (isInspectionLocked(input.currentStatus) && input.intent === 'save') {
    return input.currentStatus
  }

  if (input.intent === 'save') {
    if (input.currentStatus === 'draft' || input.currentStatus === 'in_progress') {
      const anyChecked = input.items.some((item) => item.status !== 'not_checked')
      return anyChecked ? 'in_progress' : 'draft'
    }
    return input.currentStatus
  }

  if (input.intent === 'ready_for_reinspection') {
    return 'ready_for_reinspection'
  }

  const failures = failedItems(input.items)
  if (failures.length > 0) {
    const openActions = input.correctiveActions.filter((action) => action.status !== 'closed')
    const allReady =
      openActions.length > 0 &&
      openActions.every((action) => action.status === 'ready_for_reinspection')
    if (allReady) return 'ready_for_reinspection'
    if (openActions.some((action) => action.status === 'in_progress' || action.status === 'ready_for_reinspection')) {
      return 'awaiting_correction'
    }
    return 'failed'
  }

  return 'submitted'
}

export function deriveMilestoneQualityStatus(input: {
  requiresQualityApproval: boolean
  inspections: Array<{ status: QualityInspectionStatus }>
}):
  | 'not_required'
  | 'pending'
  | 'failed'
  | 'awaiting_correction'
  | 'ready_for_approval'
  | 'approved' {
  if (!input.requiresQualityApproval) return 'not_required'
  if (input.inspections.length === 0) return 'pending'

  const statuses = input.inspections.map((row) => row.status)
  if (statuses.some((status) => status === 'failed' || status === 'rejected')) return 'failed'
  if (statuses.some((status) => status === 'awaiting_correction')) return 'awaiting_correction'
  if (statuses.some((status) => status === 'ready_for_reinspection')) return 'awaiting_correction'
  if (statuses.some((status) => status === 'submitted')) return 'ready_for_approval'
  if (
    statuses.every((status) => status === 'approved' || status === 'closed') &&
    statuses.some((status) => status === 'approved')
  ) {
    return 'approved'
  }
  return 'pending'
}

export function canCompleteMilestoneWithQuality(input: {
  requiresQualityApproval: boolean
  inspections: Array<{ status: QualityInspectionStatus }>
}): { ok: true } | { ok: false; error: string } {
  if (!input.requiresQualityApproval) return { ok: true }
  if (input.inspections.length === 0) {
    return {
      ok: false,
      error: 'This stage requires an approved quality inspection before it can be marked completed.',
    }
  }
  const blocking = input.inspections.filter(
    (row) => row.status !== 'approved' && row.status !== 'closed',
  )
  if (blocking.length > 0) {
    return {
      ok: false,
      error: 'Quality inspection must be approved before this stage can be marked completed.',
    }
  }
  const hasApproved = input.inspections.some((row) => row.status === 'approved')
  if (!hasApproved) {
    return {
      ok: false,
      error: 'Quality inspection must be approved before this stage can be marked completed.',
    }
  }
  return { ok: true }
}
