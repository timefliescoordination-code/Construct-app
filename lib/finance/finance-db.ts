import { isDatabaseSetupError } from "@/lib/supabase/db-errors"

const FINANCE_TABLE_PATTERN =
  /finance_categories|company_expenses|company_income|personal_expenses/i

export const FINANCE_MIGRATIONS_HINT =
  "Finance tables are missing in Supabase. Run these SQL files in order in the SQL Editor: supabase/migrations/20260602120000_company_personal_expenses.sql, 20260602130000_company_income.sql, 20260602140000_finance_categories.sql — then refresh."

export function isMissingFinanceTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  if (isDatabaseSetupError(error)) {
    const msg = (error as { message?: string }).message ?? ""
    return FINANCE_TABLE_PATTERN.test(msg) || msg.includes("finance")
  }
  const err = error as { message?: string; code?: string }
  const msg = (err.message ?? "").toLowerCase()
  return (
    err.code === "PGRST205" ||
    err.code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    FINANCE_TABLE_PATTERN.test(msg)
  )
}

export function financeErrorMessage(error: unknown): string {
  if (isMissingFinanceTableError(error)) {
    return FINANCE_MIGRATIONS_HINT
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message)
  }
  return "Something went wrong loading finance data."
}
