import { isDatabaseSetupError } from '@/lib/supabase/db-errors'

const TABLE_PATTERN = /milestone_templates/i

export const MILESTONE_TEMPLATES_MIGRATIONS_HINT =
  'Milestone template tables are missing. Run supabase/migrations/20260824140000_milestone_templates.sql in the Supabase SQL Editor, then refresh.'

export function isMissingMilestoneTemplatesError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { message?: string; code?: string }
  const msg = err.message ?? ''
  if (isDatabaseSetupError(error) && TABLE_PATTERN.test(msg)) {
    return true
  }
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    (msg.toLowerCase().includes('could not find the table') && TABLE_PATTERN.test(msg)) ||
    (msg.toLowerCase().includes('does not exist') && TABLE_PATTERN.test(msg))
  )
}
