import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { DEFAULT_LABOUR_CATALOG } from '@/lib/labour-catalog/constants'
import type { LabourTeam, LabourType } from '@/lib/types/database'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type LabourCatalogResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type LabourCatalogPayload = {
  teams: LabourTeam[]
  types: LabourType[]
}

function asLabourTypes(rows: unknown): LabourType[] {
  return (rows ?? []) as LabourType[]
}

function asLabourTeams(rows: unknown): LabourTeam[] {
  return (rows ?? []) as LabourTeam[]
}

function nameKey(name: string) {
  return name.trim().toLowerCase()
}

async function listProjectIds(supabase: SupabaseServerClient) {
  const { data, error } = await supabase.from('projects').select('id')
  if (error) return { ids: [] as string[], error: getSupabaseErrorMessage(error) }
  return { ids: (data ?? []).map((row) => row.id as string), error: null }
}

export async function listGlobalLabourTeams(
  supabase: SupabaseServerClient,
): Promise<LabourCatalogResult<LabourTeam[]>> {
  const { data, error } = await supabase
    .from('labour_teams')
    .select('*')
    .is('project_id', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: asLabourTeams(data) }
}

export async function listGlobalLabourTypes(
  supabase: SupabaseServerClient,
): Promise<LabourCatalogResult<LabourType[]>> {
  const { data, error } = await supabase
    .from('labour_types')
    .select('*')
    .is('project_id', null)
    .not('labour_team_id', 'is', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: asLabourTypes(data) }
}

export async function listLabourCatalog(
  supabase: SupabaseServerClient,
): Promise<LabourCatalogResult<LabourCatalogPayload>> {
  const [teams, types] = await Promise.all([
    listGlobalLabourTeams(supabase),
    listGlobalLabourTypes(supabase),
  ])
  if (!teams.ok) return teams
  if (!types.ok) return types
  return { ok: true, data: { teams: teams.data, types: types.data } }
}

/** Seed company teams and roles if they are missing. Does not touch projects. */
export async function ensureLabourCatalogSeeded(
  supabase: SupabaseServerClient,
): Promise<LabourCatalogResult<LabourCatalogPayload>> {
  const existing = await listLabourCatalog(supabase)
  if (!existing.ok) return existing
  if (existing.data.teams.length > 0) return existing

  const { error: teamError } = await supabase.from('labour_teams').insert(
    DEFAULT_LABOUR_CATALOG.map((team, index) => ({
      project_id: null,
      name: team.name,
      sort_order: index + 1,
    })),
  )
  if (teamError) return { ok: false, error: getSupabaseErrorMessage(teamError) }

  const teams = await listGlobalLabourTeams(supabase)
  if (!teams.ok) return teams

  const teamIdByName = new Map(teams.data.map((team) => [nameKey(team.name), team.id]))
  const roleInserts = DEFAULT_LABOUR_CATALOG.flatMap((team) => {
    const teamId = teamIdByName.get(nameKey(team.name))
    if (!teamId) return []
    return team.roles.map((role, index) => ({
      project_id: null,
      labour_team_id: teamId,
      name: role.name,
      short_label: role.shortLabel,
      default_wage: role.defaultWage,
      sort_order: index + 1,
    }))
  })

  if (roleInserts.length) {
    const { error: roleError } = await supabase.from('labour_types').insert(roleInserts)
    if (roleError) return { ok: false, error: getSupabaseErrorMessage(roleError) }
  }

  return listLabourCatalog(supabase)
}

/** @deprecated Use ensureLabourCatalogSeeded. Kept for existing API callers. */
export async function ensureGlobalLabourTypesSeeded(
  supabase: SupabaseServerClient,
): Promise<LabourCatalogResult<LabourType[]>> {
  const catalog = await ensureLabourCatalogSeeded(supabase)
  if (!catalog.ok) return catalog
  return { ok: true, data: catalog.data.types }
}

async function addWeekRatesForProjectTypes(
  supabase: SupabaseServerClient,
  projectId: string,
  types: Array<{ id: string; default_wage: number }>,
): Promise<LabourCatalogResult> {
  if (!types.length) return { ok: true, data: undefined }

  const { data: weeks, error: weeksError } = await supabase
    .from('manpower_weeks')
    .select('id')
    .eq('project_id', projectId)

  if (weeksError) return { ok: false, error: getSupabaseErrorMessage(weeksError) }
  if (!weeks?.length) return { ok: true, data: undefined }

  const { data: existingRates, error: existingError } = await supabase
    .from('manpower_week_rates')
    .select('week_id, labour_type_id')
    .in(
      'week_id',
      weeks.map((week) => week.id),
    )

  if (existingError) return { ok: false, error: getSupabaseErrorMessage(existingError) }

  const existingKeys = new Set(
    (existingRates ?? []).map((row) => `${row.week_id}:${row.labour_type_id}`),
  )

  const rates = weeks.flatMap((week) =>
    types
      .filter((type) => !existingKeys.has(`${week.id}:${type.id}`))
      .map((type) => ({
        week_id: week.id,
        labour_type_id: type.id,
        daily_rate: Number(type.default_wage),
      })),
  )

  if (!rates.length) return { ok: true, data: undefined }

  const uniqueRates = Array.from(
    new Map(rates.map((row) => [`${row.week_id}:${row.labour_type_id}`, row])).values(),
  )

  const { error: ratesError } = await supabase
    .from('manpower_week_rates')
    .upsert(uniqueRates, { onConflict: 'week_id,labour_type_id' })
  if (ratesError) return { ok: false, error: getSupabaseErrorMessage(ratesError) }
  return { ok: true, data: undefined }
}

/** Copy missing catalog teams and roles onto one project. Safe to call on page load. */
export async function ensureProjectLabourCatalog(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<LabourCatalogResult> {
  const catalog = await ensureLabourCatalogSeeded(supabase)
  if (!catalog.ok) return catalog

  const { data: existingTeams, error: teamsError } = await supabase
    .from('labour_teams')
    .select('id, name')
    .eq('project_id', projectId)

  if (teamsError) return { ok: false, error: getSupabaseErrorMessage(teamsError) }

  const existingTeamNames = new Set(
    (existingTeams ?? []).map((row) => nameKey(String(row.name))),
  )
  const teamInserts = catalog.data.teams
    .filter((team) => !existingTeamNames.has(nameKey(team.name)))
    .map((team) => ({
      project_id: projectId,
      name: team.name,
      sort_order: Number(team.sort_order ?? 0),
    }))

  if (teamInserts.length) {
    const { error: insertError } = await supabase.from('labour_teams').insert(teamInserts)
    if (insertError) return { ok: false, error: getSupabaseErrorMessage(insertError) }
  }

  const { data: projectTeams, error: projectTeamsError } = await supabase
    .from('labour_teams')
    .select('id, name')
    .eq('project_id', projectId)

  if (projectTeamsError) {
    return { ok: false, error: getSupabaseErrorMessage(projectTeamsError) }
  }

  const projectTeamIdByName = new Map(
    (projectTeams ?? []).map((row) => [nameKey(String(row.name)), row.id as string]),
  )
  const globalTeamNameById = new Map(
    catalog.data.teams.map((team) => [team.id, nameKey(team.name)]),
  )

  const { data: existingTypes, error: typesError } = await supabase
    .from('labour_types')
    .select('id, name, labour_team_id')
    .eq('project_id', projectId)

  if (typesError) return { ok: false, error: getSupabaseErrorMessage(typesError) }

  const existingTypeKeys = new Set(
    (existingTypes ?? [])
      .filter((row) => row.labour_team_id)
      .map((row) => `${row.labour_team_id}:${nameKey(String(row.name))}`),
  )

  const typeInserts = catalog.data.types.flatMap((type) => {
    const teamName = globalTeamNameById.get(type.labour_team_id ?? '')
    if (!teamName) return []
    const projectTeamId = projectTeamIdByName.get(teamName)
    if (!projectTeamId) return []
    if (existingTypeKeys.has(`${projectTeamId}:${nameKey(type.name)}`)) return []
    return [
      {
        project_id: projectId,
        labour_team_id: projectTeamId,
        name: type.name.trim(),
        short_label: type.short_label,
        default_wage: Number(type.default_wage),
        sort_order: Number(type.sort_order ?? 0),
      },
    ]
  })

  if (typeInserts.length) {
    const { error: insertError } = await supabase.from('labour_types').insert(typeInserts)
    if (insertError) return { ok: false, error: getSupabaseErrorMessage(insertError) }
  }

  const { data: projectTypes, error: projectTypesError } = await supabase
    .from('labour_types')
    .select('id, default_wage')
    .eq('project_id', projectId)

  if (projectTypesError) {
    return { ok: false, error: getSupabaseErrorMessage(projectTypesError) }
  }

  return addWeekRatesForProjectTypes(
    supabase,
    projectId,
    (projectTypes ?? []).map((row) => ({
      id: row.id as string,
      default_wage: Number(row.default_wage),
    })),
  )
}

async function copyTeamToAllProjects(
  supabase: SupabaseServerClient,
  team: Pick<LabourTeam, 'name' | 'sort_order'>,
): Promise<LabourCatalogResult> {
  const projects = await listProjectIds(supabase)
  if (projects.error) return { ok: false, error: projects.error }
  if (!projects.ids.length) return { ok: true, data: undefined }

  const { data: existing, error } = await supabase
    .from('labour_teams')
    .select('project_id, name')
    .in('project_id', projects.ids)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  const existingKeys = new Set(
    (existing ?? []).map((row) => `${row.project_id}:${nameKey(String(row.name))}`),
  )

  const inserts = projects.ids
    .filter((projectId) => !existingKeys.has(`${projectId}:${nameKey(team.name)}`))
    .map((projectId) => ({
      project_id: projectId,
      name: team.name.trim(),
      sort_order: Number(team.sort_order ?? 0),
    }))

  if (!inserts.length) return { ok: true, data: undefined }

  const { error: insertError } = await supabase.from('labour_teams').insert(inserts)
  if (insertError) return { ok: false, error: getSupabaseErrorMessage(insertError) }
  return { ok: true, data: undefined }
}

async function copyTypeToAllProjects(
  supabase: SupabaseServerClient,
  type: Pick<LabourType, 'name' | 'short_label' | 'default_wage' | 'sort_order'>,
  globalTeamName: string,
): Promise<LabourCatalogResult> {
  const projects = await listProjectIds(supabase)
  if (projects.error) return { ok: false, error: projects.error }
  if (!projects.ids.length) return { ok: true, data: undefined }

  const { data: projectTeams, error: teamsError } = await supabase
    .from('labour_teams')
    .select('id, project_id, name')
    .in('project_id', projects.ids)

  if (teamsError) return { ok: false, error: getSupabaseErrorMessage(teamsError) }

  const teamIdByProject = new Map<string, string>()
  for (const row of projectTeams ?? []) {
    if (nameKey(String(row.name)) !== nameKey(globalTeamName)) continue
    teamIdByProject.set(row.project_id as string, row.id as string)
  }

  const { data: existingTypes, error: typesError } = await supabase
    .from('labour_types')
    .select('project_id, labour_team_id, name')
    .in('project_id', projects.ids)

  if (typesError) return { ok: false, error: getSupabaseErrorMessage(typesError) }

  const existingKeys = new Set(
    (existingTypes ?? []).map(
      (row) => `${row.project_id}:${row.labour_team_id}:${nameKey(String(row.name))}`,
    ),
  )

  const inserts = projects.ids.flatMap((projectId) => {
    const teamId = teamIdByProject.get(projectId)
    if (!teamId) return []
    if (existingKeys.has(`${projectId}:${teamId}:${nameKey(type.name)}`)) return []
    return [
      {
        project_id: projectId,
        labour_team_id: teamId,
        name: type.name.trim(),
        short_label: type.short_label,
        default_wage: Number(type.default_wage),
        sort_order: Number(type.sort_order ?? 0),
      },
    ]
  })

  if (inserts.length) {
    const { error: insertError } = await supabase.from('labour_types').insert(inserts)
    if (insertError) return { ok: false, error: getSupabaseErrorMessage(insertError) }
  }

  for (const projectId of projects.ids) {
    const teamId = teamIdByProject.get(projectId)
    if (!teamId) continue
    const { data: projectTypes, error } = await supabase
      .from('labour_types')
      .select('id, default_wage')
      .eq('project_id', projectId)
      .eq('labour_team_id', teamId)
      .ilike('name', type.name.trim())

    if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
    const rates = await addWeekRatesForProjectTypes(
      supabase,
      projectId,
      (projectTypes ?? []).map((row) => ({
        id: row.id as string,
        default_wage: Number(row.default_wage),
      })),
    )
    if (!rates.ok) return rates
  }

  return { ok: true, data: undefined }
}

export async function listLabourTeamsForProject(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<LabourCatalogResult<LabourTeam[]>> {
  const ensured = await ensureProjectLabourCatalog(supabase, projectId)
  if (!ensured.ok) return ensured

  const { data, error } = await supabase
    .from('labour_teams')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: asLabourTeams(data) }
}

export async function listLabourTypesForProject(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<LabourCatalogResult<LabourType[]>> {
  const ensured = await ensureProjectLabourCatalog(supabase, projectId)
  if (!ensured.ok) return ensured

  const { data, error } = await supabase
    .from('labour_types')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  const types = asLabourTypes(data)
  const linked = types.filter((type) => type.labour_team_id)
  const unassigned = types.filter((type) => !type.labour_team_id)
  if (!unassigned.length) return { ok: true, data: linked }

  const { data: usedRows, error: usedError } = await supabase
    .from('labour_entries')
    .select('labour_type_id')
    .eq('project_id', projectId)
    .in(
      'labour_type_id',
      unassigned.map((type) => type.id),
    )

  if (usedError) return { ok: false, error: getSupabaseErrorMessage(usedError) }

  const usedIds = new Set((usedRows ?? []).map((row) => row.labour_type_id as string))
  return {
    ok: true,
    data: [...linked, ...unassigned.filter((type) => usedIds.has(type.id))],
  }
}

export async function createCompanyLabourTeam(
  supabase: SupabaseServerClient,
  name: string,
): Promise<LabourCatalogResult<{ id: string }>> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Team name is required.' }

  const catalog = await ensureLabourCatalogSeeded(supabase)
  if (!catalog.ok) return catalog

  if (catalog.data.teams.some((team) => nameKey(team.name) === nameKey(trimmed))) {
    return { ok: false, error: 'A labour team with this name already exists.' }
  }

  const lastOrder = catalog.data.teams.reduce(
    (max, team) => Math.max(max, Number(team.sort_order ?? 0)),
    0,
  )
  const sortOrder = lastOrder + 1

  const { data, error } = await supabase
    .from('labour_teams')
    .insert({
      project_id: null,
      name: trimmed,
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to create labour team.',
    }
  }

  const copied = await copyTeamToAllProjects(supabase, { name: trimmed, sort_order: sortOrder })
  if (!copied.ok) return copied

  return { ok: true, data: { id: data.id } }
}

export async function updateCompanyLabourTeam(
  supabase: SupabaseServerClient,
  input: { labourTeamId: string; name: string },
): Promise<LabourCatalogResult> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Team name is required.' }

  const { data: current, error: currentError } = await supabase
    .from('labour_teams')
    .select('id, name')
    .eq('id', input.labourTeamId)
    .maybeSingle()

  if (currentError) return { ok: false, error: getSupabaseErrorMessage(currentError) }
  if (!current) return { ok: false, error: 'Labour team not found.' }

  const { error } = await supabase
    .from('labour_teams')
    .update({ name })
    .ilike('name', current.name as string)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: undefined }
}

export async function deleteCompanyLabourTeam(
  supabase: SupabaseServerClient,
  labourTeamId: string,
): Promise<LabourCatalogResult> {
  const { data: current, error: currentError } = await supabase
    .from('labour_teams')
    .select('id, name')
    .eq('id', labourTeamId)
    .maybeSingle()

  if (currentError) return { ok: false, error: getSupabaseErrorMessage(currentError) }
  if (!current) return { ok: false, error: 'Labour team not found.' }

  const { data: siblings, error: siblingError } = await supabase
    .from('labour_teams')
    .select('id')
    .ilike('name', current.name as string)

  if (siblingError) return { ok: false, error: getSupabaseErrorMessage(siblingError) }

  const teamIds = Array.from(
    new Set([labourTeamId, ...(siblings ?? []).map((row) => row.id as string)]),
  )

  const { count: expenseCount, error: expenseError } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .in('labour_team_id', teamIds)

  if (expenseError) return { ok: false, error: getSupabaseErrorMessage(expenseError) }
  if ((expenseCount ?? 0) > 0) {
    return {
      ok: false,
      error: 'Cannot delete a team that already has labour expenses linked to it.',
    }
  }

  const { data: typeRows, error: typesError } = await supabase
    .from('labour_types')
    .select('id')
    .in('labour_team_id', teamIds)

  if (typesError) return { ok: false, error: getSupabaseErrorMessage(typesError) }

  const typeIds = (typeRows ?? []).map((row) => row.id as string)
  if (typeIds.length) {
    const { count, error: countError } = await supabase
      .from('labour_entries')
      .select('id', { count: 'exact', head: true })
      .in('labour_type_id', typeIds)

    if (countError) return { ok: false, error: getSupabaseErrorMessage(countError) }
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: 'Cannot delete a team whose roles already have manpower entries.',
      }
    }

    const { error: deleteTypesError } = await supabase
      .from('labour_types')
      .delete()
      .in('id', typeIds)
    if (deleteTypesError) return { ok: false, error: getSupabaseErrorMessage(deleteTypesError) }
  }

  const { error } = await supabase.from('labour_teams').delete().in('id', teamIds)
  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: undefined }
}

export async function createCompanyLabourType(
  supabase: SupabaseServerClient,
  input: {
    labourTeamId: string
    name: string
    shortLabel: string
    defaultWage: number
  },
): Promise<LabourCatalogResult<{ id: string }>> {
  const name = input.name.trim()
  const shortLabel = input.shortLabel.trim() || name.slice(0, 6)
  const defaultWage = Number(input.defaultWage)

  if (!name) return { ok: false, error: 'Labour type name is required.' }
  if (!Number.isFinite(defaultWage) || defaultWage < 0) {
    return { ok: false, error: 'Enter a valid default wage.' }
  }

  const catalog = await ensureLabourCatalogSeeded(supabase)
  if (!catalog.ok) return catalog

  const team = catalog.data.teams.find((row) => row.id === input.labourTeamId)
  if (!team) return { ok: false, error: 'Labour team not found.' }

  if (
    catalog.data.types.some(
      (row) =>
        row.labour_team_id === input.labourTeamId && nameKey(row.name) === nameKey(name),
    )
  ) {
    return { ok: false, error: 'This team already has that labour type.' }
  }

  const lastOrder = catalog.data.types
    .filter((row) => row.labour_team_id === input.labourTeamId)
    .reduce((max, row) => Math.max(max, Number(row.sort_order ?? 0)), 0)
  const sortOrder = lastOrder + 1

  const { data, error } = await supabase
    .from('labour_types')
    .insert({
      project_id: null,
      labour_team_id: input.labourTeamId,
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to create labour type.',
    }
  }

  const copiedTeams = await copyTeamToAllProjects(supabase, team)
  if (!copiedTeams.ok) return copiedTeams

  const copied = await copyTypeToAllProjects(
    supabase,
    {
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
      sort_order: sortOrder,
    },
    team.name,
  )
  if (!copied.ok) return copied

  return { ok: true, data: { id: data.id } }
}

export async function updateCompanyLabourType(
  supabase: SupabaseServerClient,
  input: {
    labourTypeId: string
    name: string
    shortLabel: string
    defaultWage: number
  },
): Promise<LabourCatalogResult> {
  const name = input.name.trim()
  const shortLabel = input.shortLabel.trim() || name.slice(0, 6)
  const defaultWage = Number(input.defaultWage)

  if (!name) return { ok: false, error: 'Labour type name is required.' }
  if (!Number.isFinite(defaultWage) || defaultWage < 0) {
    return { ok: false, error: 'Enter a valid default wage.' }
  }

  const { data: current, error: currentError } = await supabase
    .from('labour_types')
    .select('id, name, labour_team_id')
    .eq('id', input.labourTypeId)
    .maybeSingle()

  if (currentError) return { ok: false, error: getSupabaseErrorMessage(currentError) }
  if (!current) return { ok: false, error: 'Labour type not found.' }

  const { data: team } = await supabase
    .from('labour_teams')
    .select('name')
    .eq('id', current.labour_team_id as string)
    .maybeSingle()

  const { data: siblingTeams } = await supabase
    .from('labour_teams')
    .select('id')
    .ilike('name', team?.name ?? '')

  const teamIds = (siblingTeams ?? []).map((row) => row.id as string)
  if (!teamIds.length) {
    const { error } = await supabase
      .from('labour_types')
      .update({
        name,
        short_label: shortLabel,
        default_wage: defaultWage,
      })
      .eq('id', input.labourTypeId)
    if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
    return { ok: true, data: undefined }
  }

  const { error } = await supabase
    .from('labour_types')
    .update({
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
    })
    .in('labour_team_id', teamIds)
    .ilike('name', current.name as string)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: undefined }
}

export async function deleteCompanyLabourType(
  supabase: SupabaseServerClient,
  labourTypeId: string,
): Promise<LabourCatalogResult> {
  const { data: current, error: currentError } = await supabase
    .from('labour_types')
    .select('id, name, labour_team_id')
    .eq('id', labourTypeId)
    .maybeSingle()

  if (currentError) return { ok: false, error: getSupabaseErrorMessage(currentError) }
  if (!current) return { ok: false, error: 'Labour type not found.' }

  const { data: team } = await supabase
    .from('labour_teams')
    .select('name')
    .eq('id', current.labour_team_id as string)
    .maybeSingle()

  const { data: siblingTeams } = await supabase
    .from('labour_teams')
    .select('id')
    .ilike('name', team?.name ?? '')

  const teamIds = (siblingTeams ?? []).map((row) => row.id as string)

  const { data: siblings, error: siblingError } = teamIds.length
    ? await supabase
        .from('labour_types')
        .select('id')
        .in('labour_team_id', teamIds)
        .ilike('name', current.name as string)
    : await supabase.from('labour_types').select('id').eq('id', labourTypeId)

  if (siblingError) return { ok: false, error: getSupabaseErrorMessage(siblingError) }

  const ids = Array.from(
    new Set([labourTypeId, ...(siblings ?? []).map((row) => row.id as string)]),
  )

  const { count, error: countError } = await supabase
    .from('labour_entries')
    .select('id', { count: 'exact', head: true })
    .in('labour_type_id', ids)

  if (countError) return { ok: false, error: getSupabaseErrorMessage(countError) }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: 'Cannot delete a labour type that already has manpower entries.',
    }
  }

  const { error } = await supabase.from('labour_types').delete().in('id', ids)
  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: undefined }
}
