import { createClient } from '@/lib/supabase/server'
import type { ProjectWithDetails } from '@/lib/types/database'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { enrichProjectWithMilestoneMetrics } from '@/lib/project-tab-hydration'
import {
  getAssignedDefaultProjectId,
  getProjectAccessScope,
  NO_ASSIGNED_PROJECT_MESSAGE,
} from '@/lib/project-access'
import { stripProjectFinancialsForEngineer } from '@/lib/permissions'

export const PROJECT_LIST_SELECT = `
  *,
  milestones(*),
  expenses(*),
  client_payments(*),
  pm:profiles!pm_id(id, email, full_name, role, phone, company_name, created_at, updated_at),
  project_engineers(
    engineer_id,
    engineer:profiles!engineer_id(id, email, full_name, role, phone, company_name, created_at, updated_at)
  )
`

export const PROJECT_LIST_SELECT_BASIC = `
  *,
  milestones(*),
  expenses(*),
  client_payments(*)
`

export const PROJECT_DETAIL_SELECT = `
  ${PROJECT_LIST_SELECT.trim()},
  vendor_payments(*),
  additional_works(*)
`

export const PROJECT_DETAIL_SELECT_BASIC = `
  ${PROJECT_LIST_SELECT_BASIC.trim()},
  vendor_payments(*),
  additional_works(*)
`

async function getLabourWorkersCountForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  dateIso: string,
): Promise<number> {
  const totals = await getLabourWorkersCountByProjectForDate(supabase, [projectId], dateIso)
  return totals.get(projectId) ?? 0
}

async function getLabourWorkersCountByProjectForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIds: string[],
  dateIso: string,
): Promise<Map<string, number>> {
  const totals = new Map<string, number>()
  if (!projectIds.length) return totals

  const { data, error } = await supabase
    .from('labour_entries')
    .select('project_id, count')
    .in('project_id', projectIds)
    .eq('entry_date', dateIso)

  if (error) return totals

  for (const row of data ?? []) {
    const projectId = row.project_id as string
    totals.set(projectId, (totals.get(projectId) ?? 0) + Number(row.count))
  }

  return totals
}

function shouldRetryWithBasicSelect(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? ''
  return (
    error.code === 'PGRST205' ||
    error.code === 'PGRST200' ||
    message.includes('Could not find the table') ||
    message.includes('Could not find a relationship') ||
    message.includes('project_engineers')
  )
}

function applyRoleProjectVisibility(
  project: ProjectWithDetails,
  role: string | undefined,
): ProjectWithDetails {
  if (role === 'engineer') {
    return stripProjectFinancialsForEngineer(project)
  }
  return project
}

export async function listProjectsForApi(options?: { includeArchived?: boolean }) {
  const supabase = await createClient()
  const includeArchived = options?.includeArchived ?? false

  const access = await getProjectAccessScope(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view projects.' }
  }

  let query = supabase
    .from('projects')
    .select(PROJECT_LIST_SELECT)
    .order('created_at', { ascending: false })

  if (!includeArchived) {
    query = query.neq('status', 'archived')
  }

  let { data, error } = await query

  if (error && shouldRetryWithBasicSelect(error)) {
    let fallbackQuery = supabase
      .from('projects')
      .select(PROJECT_LIST_SELECT_BASIC)
      .order('created_at', { ascending: false })

    if (!includeArchived) {
      fallbackQuery = fallbackQuery.neq('status', 'archived')
    }

    const fallback = await fallbackQuery
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  const rows = data ?? []
  const todayIso = new Date().toISOString().slice(0, 10)
  const labourByProject = await getLabourWorkersCountByProjectForDate(
    supabase,
    rows.map((project) => project.id as string),
    todayIso,
  )

  const enriched = rows.map((project) => {
    const base = enrichProjectWithMilestoneMetrics(project as ProjectWithDetails)
    const withLabour = {
      ...base,
      labour_workers_today: labourByProject.get(project.id as string) ?? 0,
    }
    return applyRoleProjectVisibility(withLabour, access?.role)
  })

  return { data: enriched, error: null }
}

export async function getProjectByIdForApi(projectId: string) {
  const supabase = await createClient()
  const access = await getProjectAccessScope(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view this project.' }
  }

  let { data, error } = await supabase
    .from('projects')
    .select(PROJECT_DETAIL_SELECT)
    .eq('id', projectId)
    .single()

  if (error && shouldRetryWithBasicSelect(error)) {
    const fallback = await supabase
      .from('projects')
      .select(PROJECT_DETAIL_SELECT_BASIC)
      .eq('id', projectId)
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  if (data?.milestones) {
    data.milestones.sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
    )
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const labourWorkersToday = await getLabourWorkersCountForDate(
    supabase,
    projectId,
    todayIso,
  )

  const enriched = {
    ...enrichProjectWithMilestoneMetrics(data as ProjectWithDetails),
    labour_workers_today: labourWorkersToday,
  }

  return {
    data: applyRoleProjectVisibility(enriched, access?.role),
    error: null,
  }
}

export async function getDefaultProjectForApi() {
  const supabase = await createClient()

  const access = await getProjectAccessScope(supabase)
  if (!access) {
    return { data: null, error: 'You must be signed in to view projects.' }
  }

  const projectId = await getAssignedDefaultProjectId(supabase, access.scope)
  if (!projectId) {
    if (access.scope.kind === 'all') {
      return { data: null, error: null }
    }
    return { data: null, error: NO_ASSIGNED_PROJECT_MESSAGE }
  }

  const result = await getProjectByIdForApi(projectId)
  if (result.data?.status === 'archived') {
    return { data: null, error: NO_ASSIGNED_PROJECT_MESSAGE }
  }

  return result
}

export async function listLabourTypesForApi() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('labour_types')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: data ?? [], error: null }
}
