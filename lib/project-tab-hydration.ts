import type { Expense, Milestone, ProjectWithDetails } from '@/lib/types/database'

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
  return project.milestones.map((ms) => ({
    ...ms,
    actual_expenses: byMilestone[ms.id] ?? Number(ms.actual_expenses) ?? 0,
  }))
}

export function milestoneNameById(project: ProjectWithDetails): Map<string, string> {
  return new Map(project.milestones.map((ms) => [ms.id, ms.name]))
}
