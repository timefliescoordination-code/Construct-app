import type { ChangeRequestStatus, UserRole } from '@/lib/types/database'

export function canCustomerEdit(status: ChangeRequestStatus): boolean {
  return status === 'draft' || status === 'submitted'
}

export function canCustomerCancel(status: ChangeRequestStatus): boolean {
  return status === 'draft' || status === 'submitted'
}

export function isAwaitingStaffReview(status: ChangeRequestStatus): boolean {
  return (
    status === 'submitted' ||
    status === 'under_review' ||
    status === 'costing_prepared' ||
    status === 'internal_approval_pending'
  )
}

export function isAwaitingCustomerApproval(status: ChangeRequestStatus): boolean {
  return status === 'customer_approval_pending'
}

export function canEngineerEvaluate(role: UserRole | null): boolean {
  return role === 'engineer' || role === 'pm' || role === 'admin'
}

export function canPmApprove(role: UserRole | null): boolean {
  return role === 'pm' || role === 'admin'
}

export function canAdminOverride(role: UserRole | null): boolean {
  return role === 'admin'
}

export function staffChangeRequestLink(requestId: string): string {
  return `/change-requests/${requestId}`
}

export function customerChangeRequestLink(requestId: string): string {
  return `/customer?section=construction&tab=changes&requestId=${requestId}`
}
