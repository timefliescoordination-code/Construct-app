import type { SupabaseClient } from '@supabase/supabase-js'
import { formatStageLabel } from '@/lib/site-photos/stage-label'

export type ProjectStageContext = {
  milestoneId: string
  stageName: string
  stageLabel: string
}

export async function getLatestProjectStageFromExpenses(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectStageContext | null> {
  const { data: latestExpense, error: expenseError } = await supabase
    .from('expenses')
    .select('milestone_id, milestones(name)')
    .eq('project_id', projectId)
    .not('milestone_id', 'is', null)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (expenseError) {
    console.error('[site-photos] latest expense stage lookup failed:', expenseError.message)
  }

  const expenseMilestone = latestExpense?.milestones as { name?: string } | null
  const expenseStageName = expenseMilestone?.name?.trim()
  if (latestExpense?.milestone_id && expenseStageName) {
    return {
      milestoneId: latestExpense.milestone_id,
      stageName: expenseStageName,
      stageLabel: formatStageLabel(expenseStageName),
    }
  }

  const { data: activeMilestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, name')
    .eq('project_id', projectId)
    .eq('status', 'in-progress')
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (milestoneError) {
    console.error('[site-photos] in-progress milestone lookup failed:', milestoneError.message)
  }

  if (activeMilestone?.name?.trim()) {
    return {
      milestoneId: activeMilestone.id,
      stageName: activeMilestone.name.trim(),
      stageLabel: formatStageLabel(activeMilestone.name),
    }
  }

  return null
}
