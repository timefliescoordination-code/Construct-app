import type { Expense, Milestone, ProjectWithDetails } from '@/lib/types/database'
import { calculateMilestoneCompletionFromExpenses } from '@/lib/financial-calculations'

export function expensesByMilestoneId(expenses: Expense[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const exp of expenses) {
    if (exp.status === 'approved' && exp.milestone_id) {
      map[exp.milestone_id] = (map[exp.milestone_id] || 0) + Number(exp.amount)
    }
  }
  return map
}

export function milestonesWithCalculatedExpenses(project: ProjectWithDetails): Milestone[] {
  const byMilestone = expensesByMilestoneId(project.expenses)
  return project.milestones.map((ms) => {
    const actualExpenses = byMilestone[ms.id] ?? 0
    const targetBudget = Number(ms.target_budget) || 0
    return {
      ...ms,
      actual_expenses: actualExpenses,
      actual_completion_percent: calculateMilestoneCompletionFromExpenses(
        actualExpenses,
        targetBudget,
      ),
    }
  })
}

export function enrichProjectWithMilestoneMetrics(
  project: ProjectWithDetails,
): ProjectWithDetails {
  return {
    ...project,
    milestones: milestonesWithCalculatedExpenses(project),
  }
}

export function milestoneNameById(project: ProjectWithDetails): Map<string, string> {
  return new Map(project.milestones.map((ms) => [ms.id, ms.name]))
}
