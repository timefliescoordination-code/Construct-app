import { createClient } from '@/lib/supabase/server'
import type { ProjectWithDetails } from '@/lib/types/database'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import {
  getAssignedDefaultProjectId,
  getProjectAccessScope,
  NO_ASSIGNED_PROJECT_MESSAGE,
} from '@/lib/project-access'

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

export async function listProjectsForApi() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view projects.' }
  }

  let { data, error } = await supabase
    .from('projects')
    .select(PROJECT_LIST_SELECT)
    .order('created_at', { ascending: false })

  if (error && shouldRetryWithBasicSelect(error)) {
    const fallback = await supabase
      .from('projects')
      .select(PROJECT_LIST_SELECT_BASIC)
      .order('created_at', { ascending: false })
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: data ?? [], error: null }
}

export async function getProjectByIdForApi(projectId: string) {
  const supabase = await createClient()

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

  return { data: data as ProjectWithDetails, error: null }
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

  return getProjectByIdForApi(projectId)
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
