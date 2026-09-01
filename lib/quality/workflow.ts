import type { UserRole } from '@/lib/types/database'
import {
  QUALITY_ENGINEER_EDITABLE_STATUSES,
  QUALITY_LOCKED_STATUSES,
  type QualityInspectionStatus,
} from '@/lib/quality/constants'

export function canManageQualityTemplates(role: UserRole | null): boolean {
  return role === 'admin'
}

export function canConfigureProjectQuality(role: UserRole | null): boolean {
  return role === 'admin' || role === 'pm'
}

export function canPerformInspection(role: UserRole | null): boolean {
  return role === 'engineer' || role === 'pm' || role === 'admin'
}

export function canReviewInspection(role: UserRole | null): boolean {
  return role === 'pm' || role === 'admin'
}

export function canEditInspectionResults(
  role: UserRole | null,
  status: QualityInspectionStatus,
): boolean {
  if (!canPerformInspection(role)) return false
  if (QUALITY_LOCKED_STATUSES.includes(status)) return false
  if (role === 'admin' || role === 'pm') {
    return status !== 'approved'
  }
  return QUALITY_ENGINEER_EDITABLE_STATUSES.includes(status)
}

export function canSubmitInspection(
  role: UserRole | null,
  status: QualityInspectionStatus,
): boolean {
  return canEditInspectionResults(role, status)
}

export function canApproveInspection(
  role: UserRole | null,
  status: QualityInspectionStatus,
): boolean {
  if (!canReviewInspection(role)) return false
  return status === 'submitted' || status === 'failed' || status === 'ready_for_reinspection'
}

export function inspectionStaffLink(inspectionId: string): string {
  return `/inspections/${inspectionId}`
}

export function projectQualityLink(projectId: string): string {
  return `/projects/${projectId}?tab=quality`
}
