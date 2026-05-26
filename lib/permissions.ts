import type { UserRole } from "@/lib/hooks/use-auth"

/** Site engineers must not see contract, payment, profit, or budget planning data. */
export function canViewProjectFinancials(role: UserRole | null): boolean {
  return role === "admin" || role === "pm" || role === "customer"
}

export const ENGINEER_RESTRICTED_PROJECT_TABS = new Set([
  "payments",
  "additional-works",
  "reports",
])

/** Admin, PM, and site engineers can enter manpower data. */
export function canEnterManpowerData(role: UserRole | null): boolean {
  return role === "admin" || role === "pm" || role === "engineer"
}
