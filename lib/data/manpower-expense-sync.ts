import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { formatWeekRangeLabel, weekDayDates } from '@/lib/manpower/dates'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function syncManpowerWeekToExpenses(
  supabase: SupabaseServerClient,
  input: { projectId: string; weekId: string; userId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: week, error: weekError } = await supabase
    .from('manpower_weeks')
    .select('id, project_id, milestone_id, week_number, start_date, show_in_expense')
    .eq('id', input.weekId)
    .eq('project_id', input.projectId)
    .maybeSingle()

  if (weekError) return { ok: false, error: getSupabaseErrorMessage(weekError) }
  if (!week) return { ok: false, error: 'Week not found.' }

  if (!week.show_in_expense) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('project_id', input.projectId)
      .eq('manpower_week_id', input.weekId)
      .eq('status', 'pending')
    if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
    return { ok: true }
  }

  const { data: types, error: typesError } = await supabase
    .from('labour_types')
    .select('id, labour_team_id')
    .eq('project_id', input.projectId)
    .not('labour_team_id', 'is', null)

  if (typesError) return { ok: false, error: getSupabaseErrorMessage(typesError) }

  const typeTeam = new Map(
    (types ?? []).map((row) => [row.id as string, row.labour_team_id as string]),
  )
  const dayDates = weekDayDates(week.start_date as string).map((day) => day.iso)

  const { data: entries, error: entriesError } = await supabase
    .from('labour_entries')
    .select('labour_type_id, total_cost')
    .eq('project_id', input.projectId)
    .eq('milestone_id', week.milestone_id)
    .in('entry_date', dayDates)

  if (entriesError) return { ok: false, error: getSupabaseErrorMessage(entriesError) }

  const amountByTeam = new Map<string, number>()
  for (const entry of entries ?? []) {
    const teamId = typeTeam.get(entry.labour_type_id as string)
    if (!teamId) continue
    amountByTeam.set(teamId, (amountByTeam.get(teamId) ?? 0) + Number(entry.total_cost))
  }

  const { data: teams, error: teamsError } = await supabase
    .from('labour_teams')
    .select('id, name')
    .eq('project_id', input.projectId)

  if (teamsError) return { ok: false, error: getSupabaseErrorMessage(teamsError) }

  const { data: existing, error: existingError } = await supabase
    .from('expenses')
    .select('id, labour_team_id, status')
    .eq('project_id', input.projectId)
    .eq('manpower_week_id', input.weekId)

  if (existingError) return { ok: false, error: getSupabaseErrorMessage(existingError) }

  const existingByTeam = new Map(
    (existing ?? []).map((row) => [row.labour_team_id as string, row]),
  )
  const weekLabel = formatWeekRangeLabel(week.start_date as string)

  for (const team of teams ?? []) {
    const amount = Math.round((amountByTeam.get(team.id as string) ?? 0) * 100) / 100
    const current = existingByTeam.get(team.id as string)

    if (amount <= 0) {
      if (current && current.status === 'pending') {
        const { error } = await supabase.from('expenses').delete().eq('id', current.id)
        if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
      }
      continue
    }

    const description = `Manpower · Week ${week.week_number} · ${team.name} · ${weekLabel}`
    const payload = {
      project_id: input.projectId,
      milestone_id: week.milestone_id,
      category: 'Labour',
      description,
      amount,
      vendor_name: team.name as string,
      bill_number: null,
      expense_date: week.start_date,
      labour_team_id: team.id,
      manpower_week_id: input.weekId,
      entered_by: input.userId,
    }

    if (current) {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount,
          description,
          vendor_name: team.name,
          expense_date: week.start_date,
          milestone_id: week.milestone_id,
          labour_team_id: team.id,
        })
        .eq('id', current.id)
      if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
    } else {
      const { error } = await supabase.from('expenses').insert({
        ...payload,
        status: 'pending',
      })
      if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
    }
  }

  return { ok: true }
}

export async function deletePendingManpowerWeekExpenses(
  supabase: SupabaseServerClient,
  input: { projectId: string; weekId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('project_id', input.projectId)
    .eq('manpower_week_id', input.weekId)
    .eq('status', 'pending')
  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true }
}
