import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { ensureProjectLabourCatalog } from '@/lib/data/labour-types'
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
  const ensured = await ensureProjectLabourCatalog(supabase, projectId)
  if (!ensured.ok) return ensured
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
