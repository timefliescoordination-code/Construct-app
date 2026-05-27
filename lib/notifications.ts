import type { SupabaseClient } from '@supabase/supabase-js'
import { formatINR } from '@/lib/currency'
import type { ExpenseStatus } from '@/lib/types/database'

export type AppNotification = {
  id: string
  title: string
  message: string
  type: string
  project_id: string | null
  expense_id: string | null
  read_at: string | null
  created_at: string
}

export async function notifyExpenseStatusChange(
  supabase: SupabaseClient,
  input: {
    projectId: string
    projectName: string
    expenseId: string
    expenseDescription: string
    amount: number
    status: ExpenseStatus
    actorUserId: string
  },
): Promise<void> {
  const { data: project } = await supabase
    .from('projects')
    .select('customer_id, pm_id')
    .eq('id', input.projectId)
    .maybeSingle()

  const { data: engineers } = await supabase
    .from('project_engineers')
    .select('engineer_id')
    .eq('project_id', input.projectId)

  const { data: expense } = await supabase
    .from('expenses')
    .select('entered_by')
    .eq('id', input.expenseId)
    .maybeSingle()

  const recipientIds = new Set<string>()

  if (project?.customer_id && project.customer_id !== input.actorUserId) {
    recipientIds.add(project.customer_id)
  }
  for (const row of engineers ?? []) {
    if (row.engineer_id && row.engineer_id !== input.actorUserId) {
      recipientIds.add(row.engineer_id)
    }
  }
  if (expense?.entered_by && expense.entered_by !== input.actorUserId) {
    recipientIds.add(expense.entered_by)
  }

  if (recipientIds.size === 0) return

  const statusLabel =
    input.status === 'approved'
      ? 'approved'
      : input.status === 'rejected'
        ? 'rejected'
        : 'set to pending'

  const title =
    input.status === 'approved'
      ? 'Expense approved'
      : input.status === 'rejected'
        ? 'Expense rejected'
        : 'Expense status updated'

  const message = `"${input.expenseDescription}" (${formatINR(input.amount)}) on ${input.projectName} was ${statusLabel}.`

  const rows = [...recipientIds].map((userId) => ({
    user_id: userId,
    title,
    message,
    type: 'expense_status',
    project_id: input.projectId,
    expense_id: input.expenseId,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('[notifications] insert failed:', error.message)
  }
}
