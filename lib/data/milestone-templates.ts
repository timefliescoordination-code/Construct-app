import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_MILESTONES } from '@/lib/projects/default-milestones'
import {
  MILESTONE_TEMPLATES_MIGRATIONS_HINT,
  isMissingMilestoneTemplatesError,
} from '@/lib/milestones/db'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export type MilestoneTemplateView = {
  id: string
  name: string
  expectedCostPercent: number
  sortOrder: number
}

export type MilestoneTemplateSeed = {
  name: string
  expectedCostPercent: number
  sortOrder: number
}

async function seedMilestoneTemplates(
  supabase: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('milestone_templates').insert(
    DEFAULT_MILESTONES.map((m) => ({
      name: m.name,
      expected_cost_percent: m.expected_cost_percent,
      sort_order: m.sort_order,
    })),
  )
  if (error) {
    if (isMissingMilestoneTemplatesError(error)) {
      return { ok: false, error: MILESTONE_TEMPLATES_MIGRATIONS_HINT }
    }
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }
  return { ok: true }
}

export function fallbackMilestoneTemplates(): MilestoneTemplateSeed[] {
  return DEFAULT_MILESTONES.map((m) => ({
    name: m.name,
    expectedCostPercent: m.expected_cost_percent,
    sortOrder: m.sort_order,
  }))
}

export async function loadMilestoneTemplates(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; data: MilestoneTemplateView[]; missingTable?: false }
  | { ok: false; error: string; missingTable?: boolean }
> {
  const { data, error } = await supabase
    .from('milestone_templates')
    .select('id, name, expected_cost_percent, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    if (isMissingMilestoneTemplatesError(error)) {
      return { ok: false, error: MILESTONE_TEMPLATES_MIGRATIONS_HINT, missingTable: true }
    }
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  if (!data?.length) {
    const seeded = await seedMilestoneTemplates(supabase)
    if (!seeded.ok) return seeded
    return loadMilestoneTemplates(supabase)
  }

  return {
    ok: true,
    data: data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      expectedCostPercent: Number(row.expected_cost_percent),
      sortOrder: Number(row.sort_order),
    })),
  }
}
