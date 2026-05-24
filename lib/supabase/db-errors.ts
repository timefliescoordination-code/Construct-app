export function getSupabaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Something went wrong loading data.'
  }

  const err = error as { message?: string; code?: string; details?: string; hint?: string }

  if (err.code === 'PGRST205' || err.message?.includes('Could not find the table')) {
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
