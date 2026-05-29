import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { DEFAULT_LABOUR_TEAMS } from '@/lib/labour-teams/constants'
import type { Expense, LabourTeam } from '@/lib/types/database'

export type LabourTeamExpenseSummary = {
  teamId: string
  teamName: string
  approvedTotal: number
  pendingTotal: number
}

export type LabourTeamsPayload = {
  teams: LabourTeam[]
  summaries: LabourTeamExpenseSummary[]
  totalApprovedLabour: number
}

async function ensureProjectLabourTeams(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: existingError } = await supabase
    .from('labour_teams')
    .select('id')
    .eq('project_id', projectId)
    .limit(1)

  if (existingError) {
    return { ok: false, error: getSupabaseErrorMessage(existingError) }
  }

  if (existing?.length) return { ok: true }

  const rows = DEFAULT_LABOUR_TEAMS.map((name, index) => ({
    project_id: projectId,
    name,
    sort_order: index + 1,
  }))

  const { error } = await supabase.from('labour_teams').insert(rows)
  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  return { ok: true }
}

function buildSummaries(
  teams: LabourTeam[],
  expenses: Pick<Expense, 'labour_team_id' | 'amount' | 'status' | 'category'>[],
): LabourTeamsPayload {
  const byTeam = new Map<string, LabourTeamExpenseSummary>()

  for (const team of teams) {
    byTeam.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      approvedTotal: 0,
      pendingTotal: 0,
    })
  }

  let totalApprovedLabour = 0

  for (const exp of expenses) {
    if (exp.category !== 'Labour' || !exp.labour_team_id) continue
    const summary = byTeam.get(exp.labour_team_id)
    if (!summary) continue
    const amount = Number(exp.amount)
    if (exp.status === 'approved') {
      summary.approvedTotal += amount
      totalApprovedLabour += amount
    } else if (exp.status === 'pending') {
      summary.pendingTotal += amount
    }
  }

  return {
    teams,
    summaries: teams.map((t) => byTeam.get(t.id)!),
    totalApprovedLabour,
  }
}

export async function getLabourTeamsForProject(projectId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view labour teams.' }
  }

  const ensured = await ensureProjectLabourTeams(supabase, projectId)
  if (!ensured.ok) {
    return { data: null, error: ensured.error }
  }

  const [{ data: teams, error: teamsError }, { data: expenses, error: expensesError }] =
    await Promise.all([
      supabase
        .from('labour_teams')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('expenses')
        .select('labour_team_id, amount, status, category')
        .eq('project_id', projectId)
        .eq('category', 'Labour'),
    ])

  if (teamsError) return { data: null, error: getSupabaseErrorMessage(teamsError) }
  if (expensesError) {
    return { data: null, error: getSupabaseErrorMessage(expensesError) }
  }

  const payload = buildSummaries(
    (teams ?? []) as LabourTeam[],
    (expenses ?? []) as Pick<Expense, 'labour_team_id' | 'amount' | 'status' | 'category'>[],
  )

  return { data: payload, error: null }
}
