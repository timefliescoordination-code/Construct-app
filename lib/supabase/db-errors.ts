export function getSupabaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Something went wrong loading data.'
  }

  const err = error as { message?: string; code?: string; details?: string; hint?: string }

  if (err.code === 'PGRST205' || err.message?.includes('Could not find the table')) {
    const msg = err.message ?? ''
    const isManpower =
      /manpower_weeks|manpower_week_rates/i.test(msg) ||
      (msg.includes('labour_types') && msg.includes('project_id'))

    if (isManpower) {
      return 'Manpower tables are missing. In Supabase SQL Editor, run supabase/manpower-module.sql (paste the full file contents). Run assignment-scoped-access.sql first if that script errors on is_admin or user_can_access_project. Then refresh this page.'
    }

    return 'Database tables are missing. Run supabase/schema.sql in Supabase SQL Editor (copy the file contents, not the filename), then refresh this page.'
  }

  if (err.message) return err.message
  if (err.details) return err.details
  if (err.hint) return err.hint

  return 'Something went wrong loading data.'
}

export function isDatabaseSetupError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string }
  return err.code === 'PGRST205' || !!err.message?.includes('Could not find the table')
}
