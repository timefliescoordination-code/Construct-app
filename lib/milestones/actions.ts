'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminSession } from '@/lib/auth/require-admin'
import { loadMilestoneTemplates } from '@/lib/data/milestone-templates'
import type { MilestoneTemplateView } from '@/lib/data/milestone-templates'
import {
  MILESTONE_TEMPLATES_MIGRATIONS_HINT,
  isMissingMilestoneTemplatesError,
} from '@/lib/milestones/db'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export type MilestoneTemplateActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function revalidateTemplates() {
  revalidatePath('/admin/settings/milestones')
  revalidatePath('/projects')
}

function catalogError(error: unknown, fallback: string) {
  if (isMissingMilestoneTemplatesError(error)) {
    return MILESTONE_TEMPLATES_MIGRATIONS_HINT
  }
  return error ? getSupabaseErrorMessage(error) : fallback
}

export async function getMilestoneTemplatesAction(): Promise<
  MilestoneTemplateActionResult<MilestoneTemplateView[]>
> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const result = await loadMilestoneTemplates(session.supabase)
  if (!result.ok) return result
  return { ok: true, data: result.data }
}

export async function createMilestoneTemplateAction(input: {
  name: string
  expectedCostPercent: number
}): Promise<MilestoneTemplateActionResult<{ id: string }>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Stage name is required.' }

  const percent = Number(input.expectedCostPercent)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { ok: false, error: 'Budget allocation must be between 0 and 100.' }
  }

  const { data: last } = await session.supabase
    .from('milestone_templates')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await session.supabase
    .from('milestone_templates')
    .insert({
      name,
      expected_cost_percent: percent,
      sort_order: Number(last?.sort_order ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: catalogError(error, 'Failed to create stage.') }
  }

  revalidateTemplates()
  return { ok: true, data: { id: data.id } }
}

export async function updateMilestoneTemplateAction(input: {
  id: string
  name: string
  expectedCostPercent: number
}): Promise<MilestoneTemplateActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Stage name is required.' }

  const percent = Number(input.expectedCostPercent)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { ok: false, error: 'Budget allocation must be between 0 and 100.' }
  }

  const { error } = await session.supabase
    .from('milestone_templates')
    .update({ name, expected_cost_percent: percent })
    .eq('id', input.id)

  if (error) {
    return { ok: false, error: catalogError(error, 'Failed to update stage.') }
  }

  revalidateTemplates()
  return { ok: true, data: undefined }
}

export async function deleteMilestoneTemplateAction(input: {
  id: string
}): Promise<MilestoneTemplateActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { error } = await session.supabase
    .from('milestone_templates')
    .delete()
    .eq('id', input.id)

  if (error) {
    return { ok: false, error: catalogError(error, 'Failed to delete stage.') }
  }

  revalidateTemplates()
  return { ok: true, data: undefined }
}
