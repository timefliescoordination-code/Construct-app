import { isDatabaseSetupError } from '@/lib/supabase/db-errors'

const CATALOG_TABLE_PATTERN = /expense_input_categories|expense_input_subcategories/i

export const EXPENSE_INPUT_MIGRATIONS_HINT =
  'Expense input catalog tables are missing. Run supabase/migrations/20260824120000_expense_input_catalog.sql in the Supabase SQL Editor, then refresh.'

export function isMissingExpenseInputCatalogError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { message?: string; code?: string }
  const msg = err.message ?? ''
  if (isDatabaseSetupError(error) && CATALOG_TABLE_PATTERN.test(msg)) {
    return true
  }
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    (msg.toLowerCase().includes('could not find the table') &&
      CATALOG_TABLE_PATTERN.test(msg)) ||
    (msg.toLowerCase().includes('does not exist') && CATALOG_TABLE_PATTERN.test(msg))
  )
}
