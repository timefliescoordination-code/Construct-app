'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { listLabourTypesForProject } from '@/lib/data/labour-types'
import {
  deletePendingManpowerWeekExpenses,
  syncManpowerWeekToExpenses,
} from '@/lib/data/manpower-expense-sync'
import {
  nextWeekStartDate,
  weekDayDates,
  weekStartIsoFromPickerDate,
} from '@/lib/manpower/dates'
import type { UserRole } from '@/lib/types/database'

export type ManpowerActionResult<T = void> =
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

function canEditManpower(role: UserRole) {
  return role === 'admin' || role === 'pm' || role === 'engineer'
}

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/api/projects/${projectId}/manpower`)
  revalidatePath(`/api/projects/${projectId}/labour-teams`)
}

export async function createManpowerWeekAction(input: {
  projectId: string
  milestoneId: string
  projectStartDate?: string | null
  /** Any day in the target week; stored as that week's Monday. */
  weekStartDate?: string | null
}): Promise<ManpowerActionResult<{ weekId: string }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEditManpower(session.role)) {
    return { ok: false, error: 'You do not have permission to add manpower weeks.' }
  }

  const { data: existingWeeks, error: weeksError } = await session.supabase
    .from('manpower_weeks')
    .select('week_number, start_date')
    .eq('project_id', input.projectId)
    .order('week_number', { ascending: false })

  if (weeksError) {
    return { ok: false, error: getSupabaseErrorMessage(weeksError) }
  }

  const existingStarts = (existingWeeks ?? []).map((w) => w.start_date as string)
  const nextNumber =
    existingWeeks?.length ? Number(existingWeeks[0].week_number) + 1 : 1

  let startDate: string
  if (input.weekStartDate) {
    startDate = weekStartIsoFromPickerDate(new Date(`${input.weekStartDate}T00:00:00`))
  } else {
    startDate = nextWeekStartDate(input.projectStartDate, existingStarts)
  }

  if (existingStarts.includes(startDate)) {
    return {
      ok: false,
      error: 'A week starting on this date already exists. Pick another week on the calendar.',
    }
  }

  // Resolve types before inserting the week. Listing after insert also
  // backfills rates for the new week, which then collides with the insert below.
  const typesResult = await listLabourTypesForProject(session.supabase, input.projectId)
  if (!typesResult.ok) {
    return { ok: false, error: typesResult.error }
  }

  const { data: week, error: insertError } = await session.supabase
    .from('manpower_weeks')
    .insert({
      project_id: input.projectId,
      milestone_id: input.milestoneId,
      week_number: nextNumber,
      start_date: startDate,
    })
    .select('id')
    .single()

  if (insertError || !week) {
    const duplicate =
      insertError?.code === '23505' ||
      /duplicate key|unique constraint/i.test(insertError?.message ?? '')
    if (duplicate) {
      return {
        ok: false,
        error: 'A week starting on this date already exists. Pick another week on the calendar.',
      }
    }
    return {
      ok: false,
      error: insertError
        ? getSupabaseErrorMessage(insertError)
        : 'Failed to create week.',
    }
  }

  const labourTypes = Array.from(
    new Map((typesResult.data ?? []).map((type) => [type.id, type])).values(),
  )

  if (labourTypes.length) {
    const rateRows = labourTypes.map((type) => ({
      week_id: week.id,
      labour_type_id: type.id,
      daily_rate: Number(type.default_wage),
    }))
    const { error: ratesError } = await session.supabase
      .from('manpower_week_rates')
      .upsert(rateRows, { onConflict: 'week_id,labour_type_id' })
    if (ratesError) {
      return { ok: false, error: getSupabaseErrorMessage(ratesError) }
    }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: { weekId: week.id } }
}

export async function updateManpowerWeekRateAction(input: {
  projectId: string
  weekId: string
  labourTypeId: string
  dailyRate: number
}): Promise<ManpowerActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEditManpower(session.role)) {
    return { ok: false, error: 'You do not have permission to edit rates.' }
  }

  const { data: week, error: weekError } = await session.supabase
    .from('manpower_weeks')
    .select('id, project_id, milestone_id, start_date')
    .eq('id', input.weekId)
    .eq('project_id', input.projectId)
    .single()

  if (weekError || !week) {
    return { ok: false, error: 'Week not found.' }
  }

  const { error: rateError } = await session.supabase
    .from('manpower_week_rates')
    .upsert(
      {
        week_id: input.weekId,
        labour_type_id: input.labourTypeId,
        daily_rate: input.dailyRate,
      },
      { onConflict: 'week_id,labour_type_id' },
    )

  if (rateError) {
    return { ok: false, error: getSupabaseErrorMessage(rateError) }
  }

  const dayDates = weekDayDates(week.start_date as string).map((d) => d.iso)
  const { data: entries } = await session.supabase
    .from('labour_entries')
    .select('id, count')
    .eq('project_id', input.projectId)
    .eq('milestone_id', week.milestone_id)
    .eq('labour_type_id', input.labourTypeId)
    .in('entry_date', dayDates)

  if (entries?.length) {
    for (const entry of entries) {
      const count = Number(entry.count)
      await session.supabase
        .from('labour_entries')
        .update({
          wage_per_person: input.dailyRate,
          total_cost: count * input.dailyRate,
        })
        .eq('id', entry.id)
    }
  }

  const synced = await syncManpowerWeekToExpenses(session.supabase, {
    projectId: input.projectId,
    weekId: input.weekId,
    userId: session.userId,
  })
  if (!synced.ok) return synced

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function upsertManpowerCellAction(input: {
  projectId: string
  weekId: string
  labourTypeId: string
  entryDate: string
  count: number | null
}): Promise<ManpowerActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEditManpower(session.role)) {
    return { ok: false, error: 'You do not have permission to edit manpower.' }
  }

  const { data: week, error: weekError } = await session.supabase
    .from('manpower_weeks')
    .select('id, project_id, milestone_id')
    .eq('id', input.weekId)
    .eq('project_id', input.projectId)
    .single()

  if (weekError || !week) {
    return { ok: false, error: 'Week not found.' }
  }

  const { data: rateRow } = await session.supabase
    .from('manpower_week_rates')
    .select('daily_rate')
    .eq('week_id', input.weekId)
    .eq('labour_type_id', input.labourTypeId)
    .maybeSingle()

  const { data: typeRow } = await session.supabase
    .from('labour_types')
    .select('default_wage')
    .eq('id', input.labourTypeId)
    .maybeSingle()

  const dailyRate = Number(rateRow?.daily_rate ?? typeRow?.default_wage ?? 0)

  if (!input.count || input.count <= 0) {
    const { error } = await session.supabase
      .from('labour_entries')
      .delete()
      .eq('project_id', input.projectId)
      .eq('milestone_id', week.milestone_id)
      .eq('labour_type_id', input.labourTypeId)
      .eq('entry_date', input.entryDate)

    if (error) {
      return { ok: false, error: getSupabaseErrorMessage(error) }
    }

    const synced = await syncManpowerWeekToExpenses(session.supabase, {
      projectId: input.projectId,
      weekId: input.weekId,
      userId: session.userId,
    })
    if (!synced.ok) return synced

    revalidateProject(input.projectId)
    return { ok: true, data: undefined }
  }

  const { data: existing } = await session.supabase
    .from('labour_entries')
    .select('id')
    .eq('project_id', input.projectId)
    .eq('milestone_id', week.milestone_id)
    .eq('labour_type_id', input.labourTypeId)
    .eq('entry_date', input.entryDate)
    .maybeSingle()

  const payload = {
    project_id: input.projectId,
    milestone_id: week.milestone_id,
    labour_type_id: input.labourTypeId,
    entry_date: input.entryDate,
    count: input.count,
    wage_per_person: dailyRate,
    total_cost: input.count * dailyRate,
    submitted_by: session.userId,
  }

  const { error } = existing
    ? await session.supabase.from('labour_entries').update(payload).eq('id', existing.id)
    : await session.supabase.from('labour_entries').insert(payload)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  const synced = await syncManpowerWeekToExpenses(session.supabase, {
    projectId: input.projectId,
    weekId: input.weekId,
    userId: session.userId,
  })
  if (!synced.ok) return synced

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function setManpowerWeekShowInExpenseAction(input: {
  projectId: string
  weekId: string
  showInExpense: boolean
}): Promise<ManpowerActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEditManpower(session.role)) {
    return { ok: false, error: 'You do not have permission to update this week.' }
  }

  const { data: week, error: weekError } = await session.supabase
    .from('manpower_weeks')
    .select('id')
    .eq('id', input.weekId)
    .eq('project_id', input.projectId)
    .maybeSingle()

  if (weekError) return { ok: false, error: getSupabaseErrorMessage(weekError) }
  if (!week) return { ok: false, error: 'Week not found.' }

  const { error } = await session.supabase
    .from('manpower_weeks')
    .update({ show_in_expense: input.showInExpense })
    .eq('id', input.weekId)
    .eq('project_id', input.projectId)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  const synced = await syncManpowerWeekToExpenses(session.supabase, {
    projectId: input.projectId,
    weekId: input.weekId,
    userId: session.userId,
  })
  if (!synced.ok) return synced

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function deleteManpowerWeekAction(input: {
  projectId: string
  weekId: string
}): Promise<ManpowerActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canEditManpower(session.role)) {
    return { ok: false, error: 'You do not have permission to delete weeks.' }
  }

  const { data: week, error: weekError } = await session.supabase
    .from('manpower_weeks')
    .select('id, milestone_id, start_date')
    .eq('id', input.weekId)
    .eq('project_id', input.projectId)
    .single()

  if (weekError || !week) {
    return { ok: false, error: 'Week not found.' }
  }

  const dayDates = weekDayDates(week.start_date as string).map((d) => d.iso)
  await session.supabase
    .from('labour_entries')
    .delete()
    .eq('project_id', input.projectId)
    .eq('milestone_id', week.milestone_id)
    .in('entry_date', dayDates)

  const cleared = await deletePendingManpowerWeekExpenses(session.supabase, {
    projectId: input.projectId,
    weekId: input.weekId,
  })
  if (!cleared.ok) return cleared

  const { error } = await session.supabase
    .from('manpower_weeks')
    .delete()
    .eq('id', input.weekId)
    .eq('project_id', input.projectId)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}
