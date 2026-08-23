import type { SupabaseClient } from '@supabase/supabase-js'
import { formatINR } from '@/lib/currency'
import type { ExpenseStatus } from '@/lib/types/database'

export type CustomerNotificationType =
  | 'milestone_started'
  | 'design_update'
  | 'payment_request'
  | 'site_photos'
  | 'expense_status'
  | 'change_request'

export type AppNotification = {
  id: string
  title: string
  message: string
  type: CustomerNotificationType | string
  project_id: string | null
  expense_id: string | null
  reference_id: string | null
  link_path: string | null
  read_at: string | null
  created_at: string
}

type NotifyCustomerInput = {
  projectId: string
  type: CustomerNotificationType
  title: string
  message: string
  referenceId?: string | null
  linkPath: string
  dedupeKey: string
}

async function getProjectCustomerId(
  supabase: SupabaseClient,
  projectId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('projects')
    .select('customer_id')
    .eq('id', projectId)
    .maybeSingle()

  return data?.customer_id ?? null
}

/** Insert a single customer notification; skips duplicates via dedupe_key. */
export async function notifyProjectCustomer(
  supabase: SupabaseClient,
  input: NotifyCustomerInput,
): Promise<void> {
  const customerId = await getProjectCustomerId(supabase, input.projectId)
  if (!customerId) return

  const row = {
    user_id: customerId,
    title: input.title,
    message: input.message,
    type: input.type,
    project_id: input.projectId,
    reference_id: input.referenceId ?? null,
    link_path: input.linkPath,
    dedupe_key: input.dedupeKey,
    expense_id: null,
  }

  const { error } = await supabase
    .from('notifications')
    .upsert(row, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })

  if (error) {
    console.error('[notifications] customer notify failed:', error.message)
  }
}

export async function notifyMilestoneStarted(
  supabase: SupabaseClient,
  input: { projectId: string; milestoneId: string; milestoneName: string },
): Promise<void> {
  await notifyProjectCustomer(supabase, {
    projectId: input.projectId,
    type: 'milestone_started',
    title: 'Milestone started',
    message: `Started: ${input.milestoneName}`,
    referenceId: input.milestoneId,
    linkPath: '/customer?section=construction&focus=milestones',
    dedupeKey: `milestone_started:${input.milestoneId}`,
  })
}

export async function notifyDesignUpdate(
  supabase: SupabaseClient,
  input: { projectId: string; designFileId: string; designName: string },
): Promise<void> {
  await notifyProjectCustomer(supabase, {
    projectId: input.projectId,
    type: 'design_update',
    title: 'Design update',
    message: `New design update available: ${input.designName}`,
    referenceId: input.designFileId,
    linkPath: `/customer?section=design&designId=${input.designFileId}`,
    dedupeKey: `design_update:${input.designFileId}`,
  })
}

export async function notifyPaymentRequest(
  supabase: SupabaseClient,
  input: {
    projectId: string
    paymentId: string
    amount: number
    label: string
  },
): Promise<void> {
  await notifyProjectCustomer(supabase, {
    projectId: input.projectId,
    type: 'payment_request',
    title: 'Payment requested',
    message: `Payment requested: ${formatINR(input.amount)} for ${input.label}`,
    referenceId: input.paymentId,
    linkPath: '/customer?section=construction&focus=payments',
    dedupeKey: `payment_request:${input.paymentId}`,
  })
}

export async function notifySitePhotosBatch(
  supabase: SupabaseClient,
  input: {
    projectId: string
    uploadBatchId: string
    photoCount: number
    uploadedAt: Date
  },
): Promise<void> {
  const message =
    input.photoCount > 0
      ? `New site photos are available. (${input.photoCount} photos)`
      : 'New site photos are available.'

  await notifyProjectCustomer(supabase, {
    projectId: input.projectId,
    type: 'site_photos',
    title: 'New site photos',
    message,
    referenceId: input.uploadBatchId,
    linkPath: '/customer?section=construction&tab=photos',
    dedupeKey: `site_photos:${input.uploadBatchId}`,
  })
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

  // Customers are intentionally excluded — daily expense approvals are internal ops.
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
