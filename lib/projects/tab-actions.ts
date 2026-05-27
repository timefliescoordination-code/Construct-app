'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { calculateMilestoneCompletionFromExpenses } from '@/lib/financial-calculations'
import { expensesByMilestoneId } from '@/lib/project-tab-hydration'
import type { Expense, UserRole } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export type TabActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

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

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/admin')
  revalidatePath('/pm')
}

function canEnterExpenses(role: UserRole) {
  return role === 'admin' || role === 'pm' || role === 'engineer'
}

function canManageProjectData(role: UserRole) {
  return role === 'admin' || role === 'pm'
}

/** Persist approved expense totals and derived completion % per milestone. */
async function syncProjectMilestoneMetrics(
  supabase: SupabaseClient,
  projectId: string,
): Promise<void> {
  const { data: milestones } = await supabase
    .from('milestones')
    .select('id, target_budget')
    .eq('project_id', projectId)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('milestone_id, amount, status')
    .eq('project_id', projectId)

  if (!milestones?.length) return

  const byMilestone = expensesByMilestoneId((expenses ?? []) as Expense[])

  for (const ms of milestones) {
    const actualExpenses = byMilestone[ms.id] ?? 0
    const targetBudget = Number(ms.target_budget)
    const completion = calculateMilestoneCompletionFromExpenses(
      actualExpenses,
      targetBudget,
    )

    await supabase
      .from('milestones')
      .update({
        actual_expenses: actualExpenses,
        actual_completion_percent: completion,
      })
      .eq('id', ms.id)
      .eq('project_id', projectId)
  }
}

export async function createExpenseAction(input: {
  projectId: string
  milestoneId: string | null
  category: string
  description: string
  amount: number
  vendorName: string | null
  billNumber: string | null
  expenseDate: string
}): Promise<TabActionResult<Record<string, unknown>>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEnterExpenses(session.role)) {
    return { ok: false, error: 'You do not have permission to add expenses.' }
  }

  const { data, error } = await session.supabase
    .from('expenses')
    .insert({
      project_id: input.projectId,
      milestone_id: input.milestoneId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      vendor_name: input.vendorName,
      bill_number: input.billNumber,
      expense_date: input.expenseDate,
      status: 'pending',
      entered_by: session.userId,
    })
    .select('*')
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: data as Record<string, unknown> }
}

export async function updateExpenseStatusAction(input: {
  projectId: string
  expenseId: string
  status: 'approved' | 'rejected' | 'pending'
}): Promise<TabActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageProjectData(session.role)) {
    return { ok: false, error: 'Only admins and project managers can update expense status.' }
  }

  const { error } = await session.supabase
    .from('expenses')
    .update({ status: input.status })
    .eq('id', input.expenseId)
    .eq('project_id', input.projectId)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  await syncProjectMilestoneMetrics(session.supabase, input.projectId)
  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function createClientPaymentAction(input: {
  projectId: string
  milestoneId: string | null
  stageName: string
  amount: number
  receivedDate: string | null
  status: 'pending' | 'received' | 'overdue'
  paymentMethod: string | null
  notes: string | null
}): Promise<TabActionResult<Record<string, unknown>>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageProjectData(session.role)) {
    return { ok: false, error: 'Only admins and project managers can add client payments.' }
  }

  const { data, error } = await session.supabase
    .from('client_payments')
    .insert({
      project_id: input.projectId,
      milestone_id: input.milestoneId,
      stage_name: input.stageName,
      amount: input.amount,
      received_date: input.receivedDate,
      status: input.status,
      payment_method: input.paymentMethod,
      notes: input.notes,
      entered_by: session.userId,
    })
    .select('*')
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: data as Record<string, unknown> }
}

export async function createVendorPaymentAction(input: {
  projectId: string
  vendorName: string
  totalAmount: number
  amountPaid: number
  dueDate: string | null
  status: string
  category: string | null
}): Promise<TabActionResult<Record<string, unknown>>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageProjectData(session.role)) {
    return { ok: false, error: 'Only admins and project managers can add vendor payments.' }
  }

  const { data, error } = await session.supabase
    .from('vendor_payments')
    .insert({
      project_id: input.projectId,
      vendor_name: input.vendorName,
      total_amount: input.totalAmount,
      amount_paid: input.amountPaid,
      due_date: input.dueDate,
      status: input.status,
      category: input.category,
      entered_by: session.userId,
    })
    .select('*')
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: data as Record<string, unknown> }
}

export async function createAdditionalWorkAction(input: {
  projectId: string
  description: string
  amount: number
  requestedDate: string
}): Promise<TabActionResult<Record<string, unknown>>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageProjectData(session.role)) {
    return { ok: false, error: 'Only admins and project managers can add additional works.' }
  }

  const { data, error } = await session.supabase
    .from('additional_works')
    .insert({
      project_id: input.projectId,
      description: input.description,
      amount: input.amount,
      requested_date: input.requestedDate,
      approval_status: 'pending',
    })
    .select('id, description, amount, approval_status, requested_date, notes')
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: data as Record<string, unknown> }
}

export type MilestoneUpdateInput = {
  id: string
  expected_cost_percent: number
  target_budget: number
  status: string
  notes: string | null
}

export async function updateMilestonesAction(input: {
  projectId: string
  milestones: MilestoneUpdateInput[]
}): Promise<TabActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageProjectData(session.role)) {
    return { ok: false, error: 'Only admins and project managers can update milestones.' }
  }

  for (const milestone of input.milestones) {
    const { error } = await session.supabase
      .from('milestones')
      .update({
        expected_cost_percent: milestone.expected_cost_percent,
        target_budget: milestone.target_budget,
        status: milestone.status,
        notes: milestone.notes,
      })
      .eq('id', milestone.id)
      .eq('project_id', input.projectId)

    if (error) {
      return { ok: false, error: getSupabaseErrorMessage(error) }
    }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function createMilestoneAction(input: {
  projectId: string
  name: string
  expected_cost_percent: number
  target_budget: number
  expected_duration: string | null
  notes: string | null
  status: string
  sort_order: number
}): Promise<TabActionResult<Record<string, unknown>>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageProjectData(session.role)) {
    return { ok: false, error: 'Only admins and project managers can add milestones.' }
  }

  const { data, error } = await session.supabase
    .from('milestones')
    .insert({
      project_id: input.projectId,
      name: input.name,
      expected_cost_percent: input.expected_cost_percent,
      target_budget: input.target_budget,
      expected_duration: input.expected_duration,
      notes: input.notes,
      status: input.status,
      actual_completion_percent: 0,
      actual_expenses: 0,
      sort_order: input.sort_order,
    })
    .select('*')
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: data as Record<string, unknown> }
}

export async function updateMilestoneAction(input: {
  projectId: string
  milestoneId: string
  name: string
  expected_cost_percent: number
  target_budget: number
  expected_duration: string | null
  notes: string | null
  status: string
}): Promise<TabActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageProjectData(session.role)) {
    return { ok: false, error: 'Only admins and project managers can update milestones.' }
  }

  const { data: expenses } = await session.supabase
    .from('expenses')
    .select('milestone_id, amount, status')
    .eq('project_id', input.projectId)
    .eq('milestone_id', input.milestoneId)
    .eq('status', 'approved')

  const actualExpenses = (expenses ?? []).reduce(
    (sum, exp) => sum + Number(exp.amount),
    0,
  )
  const completion = calculateMilestoneCompletionFromExpenses(
    actualExpenses,
    input.target_budget,
  )

  const { error } = await session.supabase
    .from('milestones')
    .update({
      name: input.name,
      expected_cost_percent: input.expected_cost_percent,
      target_budget: input.target_budget,
      expected_duration: input.expected_duration,
      notes: input.notes,
      status: input.status,
      actual_expenses: actualExpenses,
      actual_completion_percent: completion,
    })
    .eq('id', input.milestoneId)
    .eq('project_id', input.projectId)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function deleteMilestoneAction(input: {
  projectId: string
  milestoneId: string
}): Promise<TabActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageProjectData(session.role)) {
    return { ok: false, error: 'Only admins and project managers can delete milestones.' }
  }

  const { error } = await session.supabase
    .from('milestones')
    .delete()
    .eq('id', input.milestoneId)
    .eq('project_id', input.projectId)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}
