import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { loadMilestoneTemplates } from '@/lib/data/milestone-templates'
import {
  calculateExpectedProfit,
  calculateStageBudget,
  calculateTotalContractValue,
} from '@/lib/financial-calculations'
import { canManageProjectData } from '@/lib/permissions'
import type { UserRole } from '@/lib/types/database'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export type ExpenseMilestoneOption = {
  id: string
  name: string
}

type ProjectMilestoneRow = {
  id: string
  name: string
  sort_order: number
}

async function loadProjectMilestoneRows(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ ok: true; data: ProjectMilestoneRow[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('milestones')
    .select('id, name, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      sort_order: Number(row.sort_order),
    })),
  }
}

async function stageBudgetForProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<number> {
  const { data } = await supabase
    .from('projects')
    .select('contract_value, additional_works_value, expected_margin_percent')
    .eq('id', projectId)
    .maybeSingle()

  if (!data) return 0

  const contractValue = Number(data.contract_value) || 0
  const additionalWorks = Number(data.additional_works_value) || 0
  const margin = Number(data.expected_margin_percent) || 0
  const total = calculateTotalContractValue(contractValue, additionalWorks)
  const profit = calculateExpectedProfit(total, margin)
  return calculateStageBudget(total, profit)
}

export async function syncProjectMilestonesFromTemplates(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const catalog = await loadMilestoneTemplates(supabase)
  if (!catalog.ok) {
    if (catalog.missingTable) return { ok: true }
    return catalog
  }

  const existing = await loadProjectMilestoneRows(supabase, projectId)
  if (!existing.ok) return existing
  if (existing.data.length === 0) return { ok: true }

  const claimed = new Set<string>()
  const stageBudget = await stageBudgetForProject(supabase, projectId)

  for (const template of catalog.data) {
    const bySort = existing.data.find(
      (row) => row.sort_order === template.sortOrder && !claimed.has(row.id),
    )
    const byName = existing.data.find(
      (row) =>
        !claimed.has(row.id) &&
        row.name.trim().toLowerCase() === template.name.trim().toLowerCase(),
    )
    const match = bySort ?? byName

    if (match) {
      claimed.add(match.id)
      if (match.name !== template.name) {
        const { error } = await supabase
          .from('milestones')
          .update({ name: template.name })
          .eq('id', match.id)
          .eq('project_id', projectId)
        if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
      }
      continue
    }

    const { error } = await supabase.from('milestones').insert({
      project_id: projectId,
      name: template.name,
      expected_cost_percent: template.expectedCostPercent,
      target_budget: (stageBudget * template.expectedCostPercent) / 100,
      actual_expenses: 0,
      actual_completion_percent: 0,
      status: 'pending',
      sort_order: template.sortOrder,
    })
    if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  return { ok: true }
}

function overlayTemplateNames(
  rows: ProjectMilestoneRow[],
  templates: { name: string; sortOrder: number }[],
): ExpenseMilestoneOption[] {
  const nameBySort = new Map(templates.map((template) => [template.sortOrder, template.name]))
  return rows.map((row) => ({
    id: row.id,
    name: nameBySort.get(row.sort_order) ?? row.name,
  }))
}

export async function getMilestonesForProjectExpenseInput(projectId: string): Promise<{
  data: { milestones: ExpenseMilestoneOption[] } | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view milestones.' }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile?.role ?? null) as UserRole | null

  if (canManageProjectData(role)) {
    await syncProjectMilestonesFromTemplates(supabase, projectId)
  }

  const existing = await loadProjectMilestoneRows(supabase, projectId)
  if (!existing.ok) {
    return { data: null, error: existing.error }
  }

  const catalog = await loadMilestoneTemplates(supabase)
  const templates = catalog.ok ? catalog.data : []

  return {
    data: { milestones: overlayTemplateNames(existing.data, templates) },
    error: null,
  }
}

/** Apply admin template names/additions to every construction project. */
export async function syncConstructionProjectMilestonesFromTemplates(
  supabase: SupabaseClient,
): Promise<void> {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('lifecycle_phase', 'construction')

  for (const project of data ?? []) {
    await syncProjectMilestonesFromTemplates(supabase, project.id as string)
  }
}
