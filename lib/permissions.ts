import type { UserRole } from "@/lib/types/database"
import type { ProjectWithDetails } from "@/lib/types/database"

/** Site engineers must not see contract, payment, profit, or budget planning data. */
export function canViewProjectFinancials(role: UserRole | null): boolean {
  return role === "admin" || role === "pm" || role === "customer"
}

export function isSiteEngineer(role: UserRole | null): boolean {
  return role === "engineer"
}

export const ENGINEER_RESTRICTED_PROJECT_TABS = new Set([
  "payments",
  "additional-works",
  "reports",
])

/** Tabs a site engineer may open on a project (no payments, reports, or additional works). */
export const ENGINEER_ALLOWED_PROJECT_TABS = new Set([
  "overview",
  "expenses",
  "milestones",
  "manpower",
  "photos",
])

/** Engineers submit expenses for PM approval; only admin/PM can approve on create/import. */
export function resolveExpenseStatusForRole(
  role: UserRole,
  requested?: "approved" | "rejected" | "pending",
): "approved" | "rejected" | "pending" {
  if (role === "engineer") return "pending"
  return requested ?? "pending"
}

/** Admin, PM, and site engineers can enter manpower data. */
export function canEnterManpowerData(role: UserRole | null): boolean {
  return role === "admin" || role === "pm" || role === "engineer"
}

/** Only admin and PM can edit milestones, project settings, or approve expenses. */
export function canManageProjectData(role: UserRole | null): boolean {
  return role === "admin" || role === "pm"
}

/** Admin-only unified expenses hub and finance APIs. */
export function canAccessFinance(role: UserRole | null): boolean {
  return role === "admin"
}

/** Remove financial fields from API payloads for site engineers. */
export function stripProjectFinancialsForEngineer(
  project: ProjectWithDetails,
): ProjectWithDetails {
  return {
    ...project,
    contract_value: 0,
    additional_works_value: 0,
    expected_margin_percent: 0,
    client_payments: project.client_payments ?? [],
    vendor_payments: project.vendor_payments ?? [],
    additional_works: project.additional_works ?? [],
    expenses: project.expenses ?? [],
    milestones: project.milestones ?? [],
  }
}
