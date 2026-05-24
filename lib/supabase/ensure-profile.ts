import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types/database'

export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<{ role: UserRole | null; error: string | null }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role) {
    return { role: profile.role as UserRole, error: null }
  }

  if (profileError) {
    const message = profileError.message ?? ''
    if (
      profileError.code === 'PGRST205' ||
      message.includes('Could not find the table')
    ) {
      return {
        role: null,
        error:
          'Database not set up. Run supabase/01-profiles-setup.sql in Supabase SQL Editor, then try again.',
      }
    }
  }

  const role = (user.user_metadata?.role as UserRole) || 'customer'
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? '',
      role,
    })
    .select('role')
    .single()

  if (created?.role) {
    return { role: created.role as UserRole, error: null }
  }

  if (insertError) {
    const message = insertError.message ?? ''
    if (
      insertError.code === 'PGRST205' ||
      message.includes('Could not find the table')
    ) {
      return {
        role: null,
        error:
          'Database not set up. Run supabase/01-profiles-setup.sql in Supabase SQL Editor, then try again.',
      }
    }
    return { role: null, error: insertError.message || 'Could not create profile' }
  }

  return { role, error: null }
}
