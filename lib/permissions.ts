import type { UserRole } from "@/lib/types/database"
import type { ProjectWithDetails } from "@/lib/types/database"

/** Internal financials: margins, profit/loss, expenses, vendor data (admin & PM only). */
export function canViewProjectFinancials(role: UserRole | null): boolean {
  return role === "admin" || role === "pm"
}

/** Customer payment schedule on /customer (contract total, paid, due — no profit analysis). */
export function canViewCustomerPaymentSummary(role: UserRole | null): boolean {
  return role === "customer"
}

export function isCustomerRole(role: UserRole | null): boolean {
  return role === "customer"
}

export function isSiteEngineer(role: UserRole | null): boolean {
  return role === "engineer"
}

export const ENGINEER_RESTRICTED_PROJECT_TABS = new Set([
  "payments",
  "additional-works",
  "reports",
  "proposals",
])

/** Tabs a site engineer may open on a project (no payments, reports, or additional works). */
export const ENGINEER_ALLOWED_PROJECT_TABS = new Set([
  "overview",
  "expenses",
  "milestones",
  "manpower",
  "photos",
  "quality",
])

/** Customers only see design collaboration and site photos — no profit or internal ops. */
export const CUSTOMER_ALLOWED_PROJECT_TABS = new Set(["design", "photos"])

export function canAccessProjectTab(role: UserRole | null, tabId: string): boolean {
  if (role === "customer") {
    return CUSTOMER_ALLOWED_PROJECT_TABS.has(tabId)
  }
  if (role === "engineer") {
    return !ENGINEER_RESTRICTED_PROJECT_TABS.has(tabId)
  }
  return true
}

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

/** Internal project staff (not customers) may upload watermarked site photos. */
export function canUploadSitePhotos(role: UserRole | null): boolean {
  return role === "admin" || role === "pm" || role === "engineer"
}

/** Whether the signed-in user may upload site photos for a specific project. */
export function canUserUploadSitePhotosOnProject(
  role: UserRole | null,
  userId: string | undefined,
  project: Pick<ProjectWithDetails, "pm_id"> & {
    project_engineers?: ProjectWithDetails["project_engineers"]
  },
): boolean {
  if (!role || !userId) return false
  if (!canUploadSitePhotos(role)) return false
  if (role === "admin") return true
  if (role === "pm") return project.pm_id === userId
  if (role === "engineer") {
    return (project.project_engineers ?? []).some(
      (assignment) => assignment.engineer_id === userId,
    )
  }
  return false
}

/** Only admin and PM can edit milestones, project settings, or approve expenses. */
export function canManageProjectData(role: UserRole | null): boolean {
  return role === "admin" || role === "pm"
}

/** Admin and PM manage client quotations. Reuses canManageProjectData — no second permission system. */
export function canManageProposals(role: UserRole | null): boolean {
  return canManageProjectData(role)
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

/** Hide internal cost/profit data from customer API payloads; keep client payment schedule. */
export function stripProjectInternalDataForCustomer(
  project: ProjectWithDetails,
): ProjectWithDetails {
  return {
    ...project,
    expected_margin_percent: 0,
    additional_works_value: 0,
    expenses: [],
    vendor_payments: [],
    additional_works: [],
    milestones: (project.milestones ?? []).map((ms) => ({
      ...ms,
      expected_cost_percent: 0,
      target_budget: 0,
      actual_expenses: 0,
    })),
  }
}
