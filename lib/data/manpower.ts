import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { weekDayDates } from '@/lib/manpower/dates'
import { listLabourTypesForProject } from '@/lib/data/labour-types'
import type {
  LabourEntry,
  LabourTeam,
  LabourType,
  ManpowerWeek,
  ManpowerWeekRate,
  Milestone,
} from '@/lib/types/database'

export type ManpowerDayRow = {
  iso: string
  label: string
  day: string
  workers: Record<string, number | null>
  dayTotal: number
}

export type ManpowerWeekView = {
  id: string
  weekNumber: number
  startDate: string
  milestoneId: string
  milestoneName: string
  showInExpense: boolean
  rates: Record<string, number>
  columnTotals: Record<string, number>
  weekTotal: number
  manpowerTotal: number
  days: ManpowerDayRow[]
}

export type ManpowerPayload = {
  labourTeams: Pick<LabourTeam, 'id' | 'name' | 'sort_order'>[]
  labourTypes: LabourType[]
  milestones: Pick<Milestone, 'id' | 'name'>[]
  weeks: ManpowerWeekView[]
  totals: {
    manpower: number
    payment: number
  }
}

function buildWeekView(
  week: ManpowerWeek,
  milestoneName: string,
  labourTypes: LabourType[],
  rates: ManpowerWeekRate[],
  entries: LabourEntry[],
): ManpowerWeekView {
  const rateByType: Record<string, number> = {}
  for (const type of labourTypes) {
    const rateRow = rates.find((r) => r.labour_type_id === type.id)
    rateByType[type.id] = Number(rateRow?.daily_rate ?? type.default_wage)
  }

  const days = weekDayDates(week.start_date).map(({ iso, label, day }) => {
    const workers: Record<string, number | null> = {}
    let dayTotal = 0

    for (const type of labourTypes) {
      const entry = entries.find(
        (e) =>
          e.entry_date === iso &&
          e.labour_type_id === type.id &&
          e.milestone_id === week.milestone_id,
      )
      const count = entry ? Number(entry.count) : null
      workers[type.id] = count && count > 0 ? count : null
      if (count && count > 0) {
        dayTotal += count * rateByType[type.id]
      }
    }

    return { iso, label, day, workers, dayTotal }
  })

  const columnTotals: Record<string, number> = {}
  for (const type of labourTypes) {
    columnTotals[type.id] = days.reduce(
      (sum, day) => sum + (day.workers[type.id] || 0),
      0,
    )
  }

  const weekTotal = days.reduce((sum, day) => sum + day.dayTotal, 0)
  const manpowerTotal = Object.values(columnTotals).reduce((sum, n) => sum + n, 0)

  return {
    id: week.id,
    weekNumber: week.week_number,
    startDate: week.start_date,
    milestoneId: week.milestone_id,
    milestoneName,
    showInExpense: Boolean(week.show_in_expense),
    rates: rateByType,
    columnTotals,
    weekTotal,
    manpowerTotal,
    days,
  }
}

export async function getManpowerForProject(projectId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view manpower.' }
  }

  const typesResult = await listLabourTypesForProject(supabase, projectId)
  if (!typesResult.ok) {
    return { data: null, error: typesResult.error }
  }

  const { data: teamRows, error: teamsError } = await supabase
    .from('labour_teams')
    .select('id, name, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (teamsError) return { data: null, error: getSupabaseErrorMessage(teamsError) }

  const [
    { data: milestones, error: milestonesError },
    { data: weeks, error: weeksError },
  ] = await Promise.all([
    supabase
      .from('milestones')
      .select('id, name')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('manpower_weeks')
      .select('*')
      .eq('project_id', projectId)
      .order('week_number', { ascending: false }),
  ])

  const labourTypes = typesResult.data

  if (milestonesError) {
    return { data: null, error: getSupabaseErrorMessage(milestonesError) }
  }
  if (weeksError) return { data: null, error: getSupabaseErrorMessage(weeksError) }

  const typedWeeks = (weeks ?? []) as ManpowerWeek[]
  const typedTypes = (labourTypes ?? []) as LabourType[]
  const milestoneMap = new Map(
    (milestones ?? []).map((m) => [m.id, m.name as string]),
  )

  let rates: ManpowerWeekRate[] = []
  let entries: LabourEntry[] = []

  if (typedWeeks.length > 0) {
    const weekIds = typedWeeks.map((w) => w.id)
    const startDates = typedWeeks.map((w) => w.start_date).sort()
    const endDate = new Date(`${startDates[startDates.length - 1]}T00:00:00`)
    endDate.setDate(endDate.getDate() + 6)
    const endIso = endDate.toISOString().slice(0, 10)

    const [{ data: rateRows, error: ratesError }, { data: entryRows, error: entriesError }] =
      await Promise.all([
        supabase.from('manpower_week_rates').select('*').in('week_id', weekIds),
        supabase
          .from('labour_entries')
          .select('*')
          .eq('project_id', projectId)
          .gte('entry_date', startDates[0])
          .lte('entry_date', endIso),
      ])

    if (ratesError) return { data: null, error: getSupabaseErrorMessage(ratesError) }
    if (entriesError) {
      return { data: null, error: getSupabaseErrorMessage(entriesError) }
    }

    rates = (rateRows ?? []) as ManpowerWeekRate[]
    entries = (entryRows ?? []) as LabourEntry[]
  }

  const weekViews = typedWeeks.map((week) =>
    buildWeekView(
      week,
      milestoneMap.get(week.milestone_id) ?? 'Unknown stage',
      typedTypes,
      rates.filter((r) => r.week_id === week.id),
      entries,
    ),
  )

  const payload: ManpowerPayload = {
    labourTeams: ((teamRows ?? []) as Pick<LabourTeam, 'id' | 'name' | 'sort_order'>[]),
    labourTypes: typedTypes,
    milestones: milestones ?? [],
    weeks: weekViews,
    totals: {
      manpower: weekViews.reduce((sum, w) => sum + w.manpowerTotal, 0),
      payment: weekViews.reduce((sum, w) => sum + w.weekTotal, 0),
    },
  }

  return { data: payload, error: null }
}
