import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/hooks/use-auth'

export type ProjectAccessScope =
  | { kind: 'all' }
  | { kind: 'customer'; userId: string }
  | { kind: 'pm'; userId: string }
  | { kind: 'engineer'; userId: string }

export async function getProjectAccessScope(
  supabase: SupabaseClient,
): Promise<{ scope: ProjectAccessScope; role: UserRole } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role as UserRole | undefined
  if (!role) return null

  if (role === 'admin') return { scope: { kind: 'all' }, role }
  if (role === 'customer') return { scope: { kind: 'customer', userId: user.id }, role }
  if (role === 'pm') return { scope: { kind: 'pm', userId: user.id }, role }
  if (role === 'engineer') return { scope: { kind: 'engineer', userId: user.id }, role }

  return null
}

/** First project id this user is allowed to see (for single-project dashboards). */
export async function getAssignedDefaultProjectId(
  supabase: SupabaseClient,
  scope: ProjectAccessScope,
): Promise<string | null> {
  if (scope.kind === 'all') {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .neq('status', 'archived')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data?.id ?? null
  }

  if (scope.kind === 'customer') {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .eq('customer_id', scope.userId)
      .neq('status', 'archived')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data?.id ?? null
  }

  if (scope.kind === 'pm') {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .eq('pm_id', scope.userId)
      .neq('status', 'archived')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data?.id ?? null
  }

  const { data } = await supabase
    .from('project_engineers')
    .select('project_id, projects!inner(status)')
    .eq('engineer_id', scope.userId)
    .neq('projects.status', 'archived')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.project_id ?? null
}

export const NO_ASSIGNED_PROJECT_MESSAGE =
  'No project is assigned to your account yet. Ask an admin to assign you in Project Edit → Staff Assignment.'
