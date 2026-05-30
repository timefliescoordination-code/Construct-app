'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import {
  MAX_EXPENSE_SPLITS,
  getSplitPaymentStatus,
  isGroupFullyRecorded,
  sumRecordedSplitAmounts,
  validateAppendSplits,
  validateInitialSplitCreate,
  type SplitLineInput,
} from '@/lib/expense-splits/calculations'
import type { UserRole } from '@/lib/types/database'

export type ExpenseSplitActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

type SplitGroupRow = {
  id: string
  project_id: string
  total_amount: number
  category: string
  description: string
  vendor_name: string | null
  bill_number: string | null
  milestone_id: string | null
  labour_team_id: string | null
  subcategory_name: string | null
}

type SplitExpenseRow = {
  id: string
  split_group_id: string | null
  split_number: number | null
  amount: number
  expense_date: string
  status: string
}

async function getSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, error: 'You must be signed in.' }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: getSupabaseErrorMessage(error) }
  }

  const role = (profile?.role ?? null) as UserRole | null
  if (!role) {
    return { ok: false as const, error: 'Your profile role is not set.' }
  }

  return { ok: true as const, supabase, userId: user.id, role }
}

function canEnterExpenses(role: UserRole) {
  return role === 'admin' || role === 'pm' || role === 'engineer'
}

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
}

import { syncProjectMilestoneMetrics } from '@/lib/projects/tab-actions'

async function syncMilestoneMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
) {
  await syncProjectMilestoneMetrics(supabase, projectId)
}

async function loadGroupWithSplits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  groupId: string,
) {
  const { data: group, error: groupError } = await supabase
    .from('expense_split_groups')
    .select('*')
    .eq('id', groupId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (groupError) return { ok: false as const, error: getSupabaseErrorMessage(groupError) }
  if (!group) return { ok: false as const, error: 'Split group not found.' }

  const { data: splits, error: splitsError } = await supabase
    .from('expenses')
    .select('id, split_group_id, split_number, amount, expense_date, status')
    .eq('split_group_id', groupId)
    .eq('project_id', projectId)
    .order('split_number', { ascending: true })

  if (splitsError) return { ok: false as const, error: getSupabaseErrorMessage(splitsError) }

  return {
    ok: true as const,
    group: group as SplitGroupRow,
    splits: (splits ?? []) as SplitExpenseRow[],
  }
}

async function syncVendorPaymentForSplitGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  groupId: string,
  userId: string,
) {
  const loaded = await loadGroupWithSplits(supabase, projectId, groupId)
  if (!loaded.ok) return

  const { group, splits } = loaded
  const vendorName = group.vendor_name?.trim()
  if (!vendorName) return

  const totalAmount = Number(group.total_amount)
  const amountPaid = sumRecordedSplitAmounts(splits)

  let status: 'pending' | 'partial' | 'paid' = 'pending'
  if (isGroupFullyRecorded(totalAmount, splits)) {
    status = 'paid'
  } else if (amountPaid > 0) {
    status = 'partial'
  }

  const payload = {
    project_id: projectId,
    vendor_name: vendorName,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    status,
    category: group.category,
    expense_split_group_id: groupId,
    entered_by: userId,
    notes: 'Linked to split expense payments',
  }

  const { data: existing } = await supabase
    .from('vendor_payments')
    .select('id')
    .eq('expense_split_group_id', groupId)
    .maybeSingle()

  if (existing?.id) {
    await supabase.from('vendor_payments').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('vendor_payments').insert(payload)
  }
}

async function removeVendorPaymentForSplitGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
) {
  await supabase
    .from('vendor_payments')
    .delete()
    .eq('expense_split_group_id', groupId)
}

export async function createExpenseSplitGroupAction(input: {
  projectId: string
  totalAmount: number
  category: string
  description: string
  vendorName: string | null
  billNumber: string | null
  milestoneId: string | null
  labourTeamId: string | null
  subcategoryName: string | null
  splits: SplitLineInput[]
  status?: 'approved' | 'rejected' | 'pending'
}): Promise<ExpenseSplitActionResult<{ groupId: string; expenseIds: string[] }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEnterExpenses(session.role)) {
    return { ok: false, error: 'You do not have permission to add expenses.' }
  }

  const validation = validateInitialSplitCreate(input.totalAmount, input.splits)
  if (!validation.ok) return validation

  const { data: group, error: groupError } = await session.supabase
    .from('expense_split_groups')
    .insert({
      project_id: input.projectId,
      total_amount: input.totalAmount,
      category: input.category,
      description: input.description,
      vendor_name: input.vendorName,
      bill_number: input.billNumber,
      milestone_id: input.milestoneId,
      labour_team_id: input.labourTeamId,
      subcategory_name: input.subcategoryName,
    })
    .select('id')
    .single()

  if (groupError || !group) {
    return {
      ok: false,
      error: groupError ? getSupabaseErrorMessage(groupError) : 'Failed to create split group.',
    }
  }

  const status = input.status ?? 'pending'
  const rows = input.splits.map((split, index) => ({
    project_id: input.projectId,
    split_group_id: group.id,
    split_number: index + 1,
    milestone_id: input.milestoneId,
    category: input.category,
    description: input.description,
    amount: parseFloat(split.amount),
    vendor_name: input.vendorName,
    bill_number: input.billNumber,
    expense_date: split.date,
    labour_team_id: input.labourTeamId,
    status,
    entered_by: session.userId,
  }))

  const { data: expenses, error: expensesError } = await session.supabase
    .from('expenses')
    .insert(rows)
    .select('id')

  if (expensesError) {
    await session.supabase.from('expense_split_groups').delete().eq('id', group.id)
    return { ok: false, error: getSupabaseErrorMessage(expensesError) }
  }

  if (status === 'approved') {
    await syncMilestoneMetrics(session.supabase, input.projectId)
  }

  await syncVendorPaymentForSplitGroup(
    session.supabase,
    input.projectId,
    group.id as string,
    session.userId,
  )

  revalidateProject(input.projectId)
  return {
    ok: true,
    data: {
      groupId: group.id as string,
      expenseIds: (expenses ?? []).map((e) => e.id as string),
    },
  }
}

export async function updateExpenseSplitGroupAction(input: {
  projectId: string
  groupId: string
  /** Split rows to keep (locked) — only id required */
  existingSplitIds: string[]
  /** New splits to append */
  newSplits: SplitLineInput[]
  /** Split expense ids to delete */
  deleteSplitIds: string[]
}): Promise<ExpenseSplitActionResult<{ expenseIds: string[] }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEnterExpenses(session.role)) {
    return { ok: false, error: 'You do not have permission to edit expenses.' }
  }

  const loaded = await loadGroupWithSplits(session.supabase, input.projectId, input.groupId)
  if (!loaded.ok) return loaded

  const { group, splits: currentSplits } = loaded
  const totalAmount = Number(group.total_amount)

  const remaining = currentSplits.filter(
    (s) => !input.deleteSplitIds.includes(s.id) && input.existingSplitIds.includes(s.id),
  )

  if (input.newSplits.length === 0 && input.deleteSplitIds.length === 0) {
    return { ok: false, error: 'Add a payment amount and date to continue.' }
  }

  const validation = validateAppendSplits(totalAmount, remaining, input.newSplits)
  if (!validation.ok) return validation

  for (const deleteId of input.deleteSplitIds) {
    const { error } = await session.supabase
      .from('expenses')
      .delete()
      .eq('id', deleteId)
      .eq('split_group_id', input.groupId)
      .eq('project_id', input.projectId)

    if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  const status = currentSplits[0]?.status ?? 'pending'
  const newRows = input.newSplits.map((split, index) => ({
    project_id: input.projectId,
    split_group_id: input.groupId,
    split_number: remaining.length + index + 1,
    milestone_id: group.milestone_id,
    category: group.category,
    description: group.description,
    amount: parseFloat(split.amount),
    vendor_name: group.vendor_name,
    bill_number: group.bill_number,
    expense_date: split.date,
    labour_team_id: group.labour_team_id,
    status,
    entered_by: session.userId,
  }))

  let insertedIds: string[] = []
  if (newRows.length > 0) {
    const { data: inserted, error: insertError } = await session.supabase
      .from('expenses')
      .insert(newRows)
      .select('id')

    if (insertError) return { ok: false, error: getSupabaseErrorMessage(insertError) }
    insertedIds = (inserted ?? []).map((r) => r.id as string)
  }

  const { data: allSplits, error: renumberError } = await session.supabase
    .from('expenses')
    .select('id, expense_date, split_number')
    .eq('split_group_id', input.groupId)
    .order('expense_date', { ascending: false })

  if (renumberError) return { ok: false, error: getSupabaseErrorMessage(renumberError) }

  const ordered = (allSplits ?? []).sort(
    (a, b) =>
      new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime(),
  )

  for (let i = 0; i < ordered.length; i++) {
    await session.supabase
      .from('expenses')
      .update({ split_number: i + 1 })
      .eq('id', ordered[i].id)
  }

  await syncMilestoneMetrics(session.supabase, input.projectId)
  await syncVendorPaymentForSplitGroup(
    session.supabase,
    input.projectId,
    input.groupId,
    session.userId,
  )
  revalidateProject(input.projectId)

  return {
    ok: true,
    data: {
      expenseIds: [...remaining.map((s) => s.id), ...insertedIds],
    },
  }
}

export async function deleteExpenseSplitRowAction(input: {
  projectId: string
  expenseId: string
}): Promise<ExpenseSplitActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEnterExpenses(session.role)) {
    return { ok: false, error: 'You do not have permission to delete expenses.' }
  }

  const { data: row, error: fetchError } = await session.supabase
    .from('expenses')
    .select('id, split_group_id')
    .eq('id', input.expenseId)
    .eq('project_id', input.projectId)
    .maybeSingle()

  if (fetchError) return { ok: false, error: getSupabaseErrorMessage(fetchError) }
  if (!row) return { ok: false, error: 'Expense not found.' }

  const groupId = row.split_group_id as string | null

  const { error } = await session.supabase
    .from('expenses')
    .delete()
    .eq('id', input.expenseId)
    .eq('project_id', input.projectId)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  if (groupId) {
    const { count } = await session.supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('split_group_id', groupId)

    if ((count ?? 0) === 0) {
      await removeVendorPaymentForSplitGroup(session.supabase, groupId)
      await session.supabase.from('expense_split_groups').delete().eq('id', groupId)
    } else {
      const { data: remaining } = await session.supabase
        .from('expenses')
        .select('id, expense_date')
        .eq('split_group_id', groupId)
        .order('expense_date', { ascending: false })

      const ordered = remaining ?? []
      for (let i = 0; i < ordered.length; i++) {
        await session.supabase
          .from('expenses')
          .update({ split_number: i + 1 })
          .eq('id', ordered[i].id)
      }
      await syncVendorPaymentForSplitGroup(
        session.supabase,
        input.projectId,
        groupId,
        session.userId,
      )
    }
  }

  await syncMilestoneMetrics(session.supabase, input.projectId)
  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export type OpenSplitGroupSummary = {
  groupId: string
  category: string
  subcategory_name: string | null
  labour_team_id: string | null
  total: number
  recorded: number
  splitCount: number
  vendor_name: string | null
}

export async function listOpenSplitGroupsAction(
  projectId: string,
): Promise<ExpenseSplitActionResult<OpenSplitGroupSummary[]>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEnterExpenses(session.role)) {
    return { ok: false, error: 'You do not have permission to view expenses.' }
  }

  const { data: groups, error: groupsError } = await session.supabase
    .from('expense_split_groups')
    .select(
      'id, category, subcategory_name, labour_team_id, total_amount, vendor_name',
    )
    .eq('project_id', projectId)

  if (groupsError) {
    return { ok: false, error: getSupabaseErrorMessage(groupsError) }
  }

  const { data: splitRows, error: splitsError } = await session.supabase
    .from('expenses')
    .select('split_group_id, amount')
    .eq('project_id', projectId)
    .not('split_group_id', 'is', null)

  if (splitsError) {
    return { ok: false, error: getSupabaseErrorMessage(splitsError) }
  }

  const recordedByGroup = new Map<string, { sum: number; count: number }>()
  for (const row of splitRows ?? []) {
    const groupId = row.split_group_id as string
    const current = recordedByGroup.get(groupId) ?? { sum: 0, count: 0 }
    recordedByGroup.set(groupId, {
      sum: current.sum + Number(row.amount),
      count: current.count + 1,
    })
  }

  const open: OpenSplitGroupSummary[] = []
  for (const group of groups ?? []) {
    const stats = recordedByGroup.get(group.id) ?? { sum: 0, count: 0 }
    const total = Number(group.total_amount)
    const recorded = stats.sum
    if (recorded >= total - 0.01) continue

    open.push({
      groupId: group.id,
      category: group.category,
      subcategory_name: group.subcategory_name,
      labour_team_id: group.labour_team_id,
      total,
      recorded,
      splitCount: stats.count,
      vendor_name: group.vendor_name,
    })
  }

  return { ok: true, data: open }
}

export async function getExpenseSplitGroupAction(input: {
  projectId: string
  groupId: string
}): Promise<
  ExpenseSplitActionResult<{
    group: SplitGroupRow
    splits: SplitExpenseRow[]
    paymentStatus: ReturnType<typeof getSplitPaymentStatus>
  }>
> {
  const session = await getSession()
  if (!session.ok) return session

  const loaded = await loadGroupWithSplits(session.supabase, input.projectId, input.groupId)
  if (!loaded.ok) return loaded

  const paymentStatus = getSplitPaymentStatus(
    Number(loaded.group.total_amount),
    loaded.splits,
  )

  return {
    ok: true,
    data: {
      group: loaded.group,
      splits: loaded.splits,
      paymentStatus,
    },
  }
}
