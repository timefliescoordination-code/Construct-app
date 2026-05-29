'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import type { UserRole } from '@/lib/types/database'

export type LabourTeamActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function getSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, error: 'You must be signed in.' }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: getSupabaseErrorMessage(error) }
  }

  const role = (profile?.role ?? null) as UserRole | null
  if (!role) {
    return { ok: false as const, error: 'Your profile role is not set.' }
  }

  return { ok: true as const, supabase, role }
}

function canManageLabourTeams(role: UserRole) {
  return role === 'admin' || role === 'pm'
}

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/api/projects/${projectId}/labour-teams`)
}

export async function createLabourTeamAction(input: {
  projectId: string
  name: string
}): Promise<LabourTeamActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageLabourTeams(session.role)) {
    return { ok: false, error: 'Only admins and project managers can add labour teams.' }
  }

  const name = input.name.trim()
  if (!name) {
    return { ok: false, error: 'Team name is required.' }
  }

  const { data: lastTeam } = await session.supabase
    .from('labour_teams')
    .select('sort_order')
    .eq('project_id', input.projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await session.supabase
    .from('labour_teams')
    .insert({
      project_id: input.projectId,
      name,
      sort_order: Number(lastTeam?.sort_order ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to create labour team.',
    }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: { id: data.id } }
}

export async function updateLabourTeamAction(input: {
  projectId: string
  labourTeamId: string
  name: string
}): Promise<LabourTeamActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageLabourTeams(session.role)) {
    return { ok: false, error: 'Only admins and project managers can edit labour teams.' }
  }

  const name = input.name.trim()
  if (!name) {
    return { ok: false, error: 'Team name is required.' }
  }

  const { error } = await session.supabase
    .from('labour_teams')
    .update({ name })
    .eq('id', input.labourTeamId)
    .eq('project_id', input.projectId)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function deleteLabourTeamAction(input: {
  projectId: string
  labourTeamId: string
}): Promise<LabourTeamActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageLabourTeams(session.role)) {
    return { ok: false, error: 'Only admins and project managers can delete labour teams.' }
  }

  const { count, error: countError } = await session.supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', input.projectId)
    .eq('labour_team_id', input.labourTeamId)

  if (countError) {
    return { ok: false, error: getSupabaseErrorMessage(countError) }
  }

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: 'Cannot delete a team that has labour expenses linked to it.',
    }
  }

  const { error } = await session.supabase
    .from('labour_teams')
    .delete()
    .eq('id', input.labourTeamId)
    .eq('project_id', input.projectId)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}
