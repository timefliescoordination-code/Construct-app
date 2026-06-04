'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { calculateFormSummary } from '@/lib/financial-calculations'
import { DEFAULT_MILESTONES } from '@/lib/projects/default-milestones'

export type CreateProjectInput = {
  name: string
  client_name: string
  site_address: string
  client_phone: string | null
  contract_value: number
  additional_works_value: number
  expected_margin_percent: number
  start_date: string | null
  expected_completion_date: string | null
  pm_id: string | null
  customer_id: string | null
  stage_budget: number
  assigned_engineer_ids: string[]
}

export type CreateProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string }

export type UpdateProjectInput = {
  projectId: string
  name: string
  client_name: string
  site_address: string
  contract_value: number
  additional_works_value: number
  expected_margin_percent: number
  start_date: string | null
  expected_completion_date: string | null
  status: 'active' | 'completed' | 'on-hold' | 'pending' | 'archived'
  pm_id: string | null
  customer_id: string | null
  assigned_engineer_ids: string[]
}

export type UpdateProjectResult = { ok: true } | { ok: false; error: string }

async function assertCanManageProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<
  | { ok: true; role: 'admin' | 'pm'; userId: string }
  | { ok: false; error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, error: getSupabaseErrorMessage(profileError) }
  }

  const role = profile?.role
  if (role !== 'admin' && role !== 'pm') {
    return {
      ok: false,
      error: 'Only admins and project managers can update project assignments.',
    }
  }

  return { ok: true, role, userId: user.id }
}

async function assertCanEditProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  auth: { ok: true; role: 'admin' | 'pm'; userId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (auth.role === 'admin') {
    return { ok: true }
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('pm_id')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  if (!project || project.pm_id !== auth.userId) {
    return {
      ok: false,
      error: 'You can only edit projects assigned to you as project manager.',
    }
  }

  return { ok: true }
}

const PROJECT_SETUP_ADDITIONAL_WORKS_DESCRIPTION =
  'Additional works (project setup)'

export async function createProjectAction(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { ok: false, error: 'You must be signed in to create a project.' }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return { ok: false, error: getSupabaseErrorMessage(profileError) }
    }

    const role = profile?.role
    if (!role || !['admin', 'pm', 'engineer'].includes(role)) {
      return {
        ok: false,
        error:
          'Your account cannot create projects. Use an admin or project manager account, or ask an admin to update your role in Supabase.',
      }
    }

    const projectData = {
      name: input.name.trim(),
      client_name: input.client_name.trim(),
      site_address: input.site_address.trim(),
      client_phone: input.client_phone?.trim() || null,
      contract_value: input.contract_value,
      additional_works_value: input.additional_works_value,
      expected_margin_percent: input.expected_margin_percent,
      start_date: input.start_date,
      expected_completion_date: input.expected_completion_date,
      status: 'active' as const,
      lifecycle_phase: 'design' as const,
      pm_id: input.pm_id,
      customer_id: input.customer_id,
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert(projectData)
      .select('id')
      .single()

    if (projectError || !project) {
      return {
        ok: false,
        error: projectError
          ? getSupabaseErrorMessage(projectError)
          : 'Project was created but could not be loaded. Check Row Level Security policies.',
      }
    }

    if (input.additional_works_value > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const { error: additionalWorksError } = await supabase
        .from('additional_works')
        .insert({
          project_id: project.id,
          description: PROJECT_SETUP_ADDITIONAL_WORKS_DESCRIPTION,
          amount: input.additional_works_value,
          requested_date: input.start_date ?? today,
          approval_status: 'approved',
          approved_by: user.id,
          approved_date: today,
          notes: 'Entered when the project was created',
        })

      if (additionalWorksError) {
        console.error('[createProjectAction] additional works:', additionalWorksError)
      }
    }

    if (input.assigned_engineer_ids.length > 0) {
      const engineerAssignments = input.assigned_engineer_ids.map((engineerId) => ({
        project_id: project.id,
        engineer_id: engineerId,
      }))

      const { error: engineersError } = await supabase
        .from('project_engineers')
        .insert(engineerAssignments)

      if (engineersError) {
        console.error('[createProjectAction] engineers:', engineersError)
      }
    }

    revalidatePath('/projects')
    revalidatePath(`/projects/${project.id}`)
    revalidatePath('/customer')

    return { ok: true, projectId: project.id }
  } catch (err) {
    console.error('[createProjectAction]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create project',
    }
  }
}

export async function updateProjectAction(
  input: UpdateProjectInput,
): Promise<UpdateProjectResult> {
  try {
    const supabase = await createClient()
    const auth = await assertCanManageProjects(supabase)
    if (!auth.ok) return auth

    const canEdit = await assertCanEditProject(supabase, input.projectId, auth)
    if (!canEdit.ok) return canEdit

    const { error: projectError } = await supabase
      .from('projects')
      .update({
        name: input.name.trim(),
        client_name: input.client_name.trim(),
        site_address: input.site_address.trim(),
        contract_value: input.contract_value,
        additional_works_value: input.additional_works_value,
        expected_margin_percent: input.expected_margin_percent,
        start_date: input.start_date,
        expected_completion_date: input.expected_completion_date,
        status: input.status,
        pm_id: input.pm_id,
        customer_id: input.customer_id,
      })
      .eq('id', input.projectId)

    if (projectError) {
      return { ok: false, error: getSupabaseErrorMessage(projectError) }
    }

    const today = new Date().toISOString().slice(0, 10)
    const { data: setupWork } = await supabase
      .from('additional_works')
      .select('id')
      .eq('project_id', input.projectId)
      .eq('description', PROJECT_SETUP_ADDITIONAL_WORKS_DESCRIPTION)
      .maybeSingle()

    if (input.additional_works_value > 0) {
      if (setupWork?.id) {
        const { error: setupUpdateError } = await supabase
          .from('additional_works')
          .update({
            amount: input.additional_works_value,
            approval_status: 'approved',
            approved_by: auth.userId,
            approved_date: today,
          })
          .eq('id', setupWork.id)

        if (setupUpdateError) {
          console.error('[updateProjectAction] setup additional work:', setupUpdateError)
        }
      } else {
        const { error: setupInsertError } = await supabase.from('additional_works').insert({
          project_id: input.projectId,
          description: PROJECT_SETUP_ADDITIONAL_WORKS_DESCRIPTION,
          amount: input.additional_works_value,
          requested_date: input.start_date ?? today,
          approval_status: 'approved',
          approved_by: auth.userId,
          approved_date: today,
          notes: 'Entered when the project was created',
        })

        if (setupInsertError) {
          console.error('[updateProjectAction] setup additional work:', setupInsertError)
        }
      }
    } else if (setupWork?.id) {
      await supabase.from('additional_works').delete().eq('id', setupWork.id)
    }

    const { error: deleteError } = await supabase
      .from('project_engineers')
      .delete()
      .eq('project_id', input.projectId)

    if (deleteError) {
      console.error('[updateProjectAction] delete engineers:', deleteError)
      return { ok: false, error: getSupabaseErrorMessage(deleteError) }
    }

    if (input.assigned_engineer_ids.length > 0) {
      const rows = input.assigned_engineer_ids.map((engineerId) => ({
        project_id: input.projectId,
        engineer_id: engineerId,
      }))
      const { error: insertError } = await supabase
        .from('project_engineers')
        .insert(rows)

      if (insertError) {
        console.error('[updateProjectAction] insert engineers:', insertError)
        return { ok: false, error: getSupabaseErrorMessage(insertError) }
      }
    }

    revalidatePath('/projects')
    revalidatePath(`/projects/${input.projectId}`)
    revalidatePath(`/projects/${input.projectId}/edit`)

    return { ok: true }
  } catch (err) {
    console.error('[updateProjectAction]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update project',
    }
  }
}

export type ActivateConstructionResult = { ok: true } | { ok: false; error: string }

export type ArchiveProjectResult = { ok: true } | { ok: false; error: string }

async function seedProjectMilestones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  stageBudget: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { count, error: countError } = await supabase
    .from('milestones')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if (countError) {
    return { ok: false, error: getSupabaseErrorMessage(countError) }
  }

  if ((count ?? 0) > 0) {
    return { ok: true }
  }

  const milestonesData = DEFAULT_MILESTONES.map((m) => ({
    project_id: projectId,
    name: m.name,
    expected_cost_percent: m.expected_cost_percent,
    target_budget: (stageBudget * m.expected_cost_percent) / 100,
    actual_expenses: 0,
    actual_completion_percent: 0,
    status: 'pending' as const,
    sort_order: m.sort_order,
  }))

  const { error: milestonesError } = await supabase
    .from('milestones')
    .insert(milestonesData)

  if (milestonesError) {
    return { ok: false, error: getSupabaseErrorMessage(milestonesError) }
  }

  return { ok: true }
}

export async function activateConstructionPhaseAction(
  projectId: string,
): Promise<ActivateConstructionResult> {
  try {
    const supabase = await createClient()
    const auth = await assertCanManageProjects(supabase)
    if (!auth.ok) return auth

    const canEdit = await assertCanEditProject(supabase, projectId, auth)
    if (!canEdit.ok) return canEdit

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select(
        'lifecycle_phase, contract_value, additional_works_value, expected_margin_percent',
      )
      .eq('id', projectId)
      .maybeSingle()

    if (fetchError) {
      return { ok: false, error: getSupabaseErrorMessage(fetchError) }
    }

    if (!project) {
      return { ok: false, error: 'Project not found.' }
    }

    if (project.lifecycle_phase === 'construction') {
      return { ok: false, error: 'Construction phase is already active for this project.' }
    }

    const summary = calculateFormSummary(
      Number(project.contract_value),
      Number(project.additional_works_value),
      Number(project.expected_margin_percent),
    )

    const seeded = await seedProjectMilestones(supabase, projectId, summary.stageBudget)
    if (!seeded.ok) return seeded

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        lifecycle_phase: 'construction',
        construction_activated_at: new Date().toISOString(),
        construction_activated_by: auth.userId,
      })
      .eq('id', projectId)

    if (updateError) {
      return { ok: false, error: getSupabaseErrorMessage(updateError) }
    }

    revalidatePath('/projects')
    revalidatePath(`/projects/${projectId}`)
    revalidatePath(`/projects/${projectId}/edit`)
    revalidatePath('/customer')

    return { ok: true }
  } catch (err) {
    console.error('[activateConstructionPhaseAction]', err)
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to activate construction phase',
    }
  }
}

export async function archiveProjectAction(
  projectId: string,
): Promise<ArchiveProjectResult> {
  try {
    const supabase = await createClient()
    const auth = await assertCanManageProjects(supabase)
    if (!auth.ok) return auth

    const canEdit = await assertCanEditProject(supabase, projectId, auth)
    if (!canEdit.ok) return canEdit

    const { error } = await supabase
      .from('projects')
      .update({ status: 'archived' })
      .eq('id', projectId)

    if (error) {
      const message = getSupabaseErrorMessage(error)
      if (/check constraint|projects_status_check/i.test(message)) {
        return {
          ok: false,
          error:
            'Archive is not enabled in the database yet. Run supabase/archive-project-module.sql in the Supabase SQL Editor, then try again.',
        }
      }
      return { ok: false, error: message }
    }

    revalidatePath('/projects')
    revalidatePath(`/projects/${projectId}`)
    revalidatePath(`/projects/${projectId}/edit`)
    revalidatePath('/admin')
    revalidatePath('/pm')

    return { ok: true }
  } catch (err) {
    console.error('[archiveProjectAction]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to archive project',
    }
  }
}
