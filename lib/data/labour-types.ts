import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { DEFAULT_LABOUR_TYPES } from '@/lib/manpower/constants'
import type { LabourType } from '@/lib/types/database'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type LabourTypeCatalogResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function asLabourTypes(rows: unknown): LabourType[] {
  return (rows ?? []) as LabourType[]
}

function nameKey(name: string) {
  return name.trim().toLowerCase()
}

async function addWeekRatesForType(
  supabase: SupabaseServerClient,
  projectId: string,
  labourTypeId: string,
  dailyRate: number,
) {
  const { data: weeks, error } = await supabase
    .from('manpower_weeks')
    .select('id')
    .eq('project_id', projectId)

  if (error) return { error: getSupabaseErrorMessage(error) }
  if (!weeks?.length) return { error: null }

  const { error: ratesError } = await supabase.from('manpower_week_rates').upsert(
    weeks.map((week) => ({
      week_id: week.id,
      labour_type_id: labourTypeId,
      daily_rate: dailyRate,
    })),
    { onConflict: 'week_id,labour_type_id' },
  )

  return { error: ratesError ? getSupabaseErrorMessage(ratesError) : null }
}

async function copyTypeToProject(
  supabase: SupabaseServerClient,
  projectId: string,
  type: Pick<LabourType, 'name' | 'short_label' | 'default_wage' | 'sort_order'>,
): Promise<LabourTypeCatalogResult<{ id: string }>> {
  const { data: existing } = await supabase
    .from('labour_types')
    .select('id')
    .eq('project_id', projectId)
    .ilike('name', type.name.trim())
    .maybeSingle()

  if (existing?.id) {
    const rates = await addWeekRatesForType(
      supabase,
      projectId,
      existing.id,
      Number(type.default_wage),
    )
    if (rates.error) return { ok: false, error: rates.error }
    return { ok: true, data: { id: existing.id } }
  }

  const { data, error } = await supabase
    .from('labour_types')
    .insert({
      project_id: projectId,
      name: type.name.trim(),
      short_label: type.short_label,
      default_wage: Number(type.default_wage),
      sort_order: type.sort_order,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to copy labour type to a project.',
    }
  }

  const rates = await addWeekRatesForType(
    supabase,
    projectId,
    data.id,
    Number(type.default_wage),
  )
  if (rates.error) return { ok: false, error: rates.error }
  return { ok: true, data: { id: data.id } }
}

async function listProjectIds(supabase: SupabaseServerClient) {
  const { data, error } = await supabase.from('projects').select('id')
  if (error) return { ids: [] as string[], error: getSupabaseErrorMessage(error) }
  return { ids: (data ?? []).map((row) => row.id as string), error: null }
}

export async function listGlobalLabourTypes(
  supabase: SupabaseServerClient,
): Promise<LabourTypeCatalogResult<LabourType[]>> {
  const { data, error } = await supabase
    .from('labour_types')
    .select('*')
    .is('project_id', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: asLabourTypes(data) }
}

/** Seed globals and copy any missing catalog types onto every project. */
export async function ensureCompanyLabourCatalog(
  supabase: SupabaseServerClient,
): Promise<LabourTypeCatalogResult<LabourType[]>> {
  const existing = await listGlobalLabourTypes(supabase)
  if (!existing.ok) return existing

  let globals = existing.data

  const { data: allRows, error: allError } = await supabase
    .from('labour_types')
    .select('name, short_label, default_wage, sort_order, project_id')

  if (allError) return { ok: false, error: getSupabaseErrorMessage(allError) }

  const globalNames = new Set(globals.map((row) => nameKey(row.name)))
  const toPromote: Array<{
    name: string
    short_label: string | null
    default_wage: number
    sort_order: number
  }> = []

  for (const row of allRows ?? []) {
    const key = nameKey(row.name)
    if (!key || globalNames.has(key)) continue
    globalNames.add(key)
    toPromote.push({
      name: row.name.trim(),
      short_label: row.short_label,
      default_wage: Number(row.default_wage),
      sort_order: Number(row.sort_order ?? 0),
    })
  }

  if (globals.length === 0 && toPromote.length === 0) {
    const { error: seedError } = await supabase.from('labour_types').insert(
      DEFAULT_LABOUR_TYPES.map((type, index) => ({
        project_id: null,
        name: type.name,
        short_label: type.shortLabel,
        default_wage: type.defaultWage,
        sort_order: index + 1,
      })),
    )
    if (seedError) return { ok: false, error: getSupabaseErrorMessage(seedError) }
  } else if (toPromote.length > 0) {
    const lastOrder = globals.reduce(
      (max, row) => Math.max(max, Number(row.sort_order ?? 0)),
      0,
    )
    const { error: promoteError } = await supabase.from('labour_types').insert(
      toPromote.map((type, index) => ({
        project_id: null,
        name: type.name,
        short_label: type.short_label,
        default_wage: type.default_wage,
        sort_order: type.sort_order || lastOrder + index + 1,
      })),
    )
    if (promoteError) return { ok: false, error: getSupabaseErrorMessage(promoteError) }
  }

  const refreshed = await listGlobalLabourTypes(supabase)
  if (!refreshed.ok) return refreshed
  globals = refreshed.data

  const projects = await listProjectIds(supabase)
  if (projects.error) return { ok: false, error: projects.error }

  for (const projectId of projects.ids) {
    const copied = await ensureProjectHasCatalogTypes(supabase, projectId, globals)
    if (!copied.ok) return copied
  }

  return { ok: true, data: globals }
}

export async function ensureProjectHasCatalogTypes(
  supabase: SupabaseServerClient,
  projectId: string,
  catalog?: LabourType[],
): Promise<LabourTypeCatalogResult> {
  let globals = catalog
  if (!globals) {
    const listed = await listGlobalLabourTypes(supabase)
    if (!listed.ok) return listed
    globals = listed.data
  }

  if (!globals.length) {
    const ensured = await ensureCompanyLabourCatalog(supabase)
    if (!ensured.ok) return ensured
    globals = ensured.data
  }

  for (const type of globals) {
    const copied = await copyTypeToProject(supabase, projectId, type)
    if (!copied.ok) return copied
  }

  return { ok: true, data: undefined }
}

export async function listLabourTypesForProject(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<LabourTypeCatalogResult<LabourType[]>> {
  const ensured = await ensureProjectHasCatalogTypes(supabase, projectId)
  if (!ensured.ok) return ensured

  const { data, error } = await supabase
    .from('labour_types')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  return { ok: true, data: asLabourTypes(data) }
}

export async function createCompanyLabourType(
  supabase: SupabaseServerClient,
  input: { name: string; shortLabel: string; defaultWage: number },
): Promise<LabourTypeCatalogResult<{ id: string }>> {
  const name = input.name.trim()
  const shortLabel = input.shortLabel.trim() || name.slice(0, 6)
  const defaultWage = Number(input.defaultWage)

  if (!name) return { ok: false, error: 'Labour type name is required.' }
  if (!Number.isFinite(defaultWage) || defaultWage < 0) {
    return { ok: false, error: 'Enter a valid default wage.' }
  }

  const catalog = await ensureCompanyLabourCatalog(supabase)
  if (!catalog.ok) return catalog

  if (catalog.data.some((row) => nameKey(row.name) === nameKey(name))) {
    return { ok: false, error: 'A labour type with this name already exists.' }
  }

  const lastOrder = catalog.data.reduce(
    (max, row) => Math.max(max, Number(row.sort_order ?? 0)),
    0,
  )

  const { data, error } = await supabase
    .from('labour_types')
    .insert({
      project_id: null,
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
      sort_order: lastOrder + 1,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to create labour type.',
    }
  }

  const projects = await listProjectIds(supabase)
  if (projects.error) return { ok: false, error: projects.error }

  for (const projectId of projects.ids) {
    const copied = await copyTypeToProject(supabase, projectId, {
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
      sort_order: lastOrder + 1,
    })
    if (!copied.ok) return copied
  }

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
): Promise<LabourTypeCatalogResult> {
  const name = input.name.trim()
  const shortLabel = input.shortLabel.trim() || name.slice(0, 6)
  const defaultWage = Number(input.defaultWage)

  if (!name) return { ok: false, error: 'Labour type name is required.' }
  if (!Number.isFinite(defaultWage) || defaultWage < 0) {
    return { ok: false, error: 'Enter a valid default wage.' }
  }

  const { data: current, error: currentError } = await supabase
    .from('labour_types')
    .select('*')
    .eq('id', input.labourTypeId)
    .maybeSingle()

  if (currentError) return { ok: false, error: getSupabaseErrorMessage(currentError) }
  if (!current) return { ok: false, error: 'Labour type not found.' }

  const oldName = current.name as string
  const { error } = await supabase
    .from('labour_types')
    .update({
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
    })
    .ilike('name', oldName)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  const projects = await listProjectIds(supabase)
  if (projects.error) return { ok: false, error: projects.error }

  for (const projectId of projects.ids) {
    const copied = await copyTypeToProject(supabase, projectId, {
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
      sort_order: Number(current.sort_order ?? 0),
    })
    if (!copied.ok) return copied
  }

  return { ok: true, data: undefined }
}

export async function deleteCompanyLabourType(
  supabase: SupabaseServerClient,
  labourTypeId: string,
): Promise<LabourTypeCatalogResult> {
  const { data: current, error: currentError } = await supabase
    .from('labour_types')
    .select('id, name')
    .eq('id', labourTypeId)
    .maybeSingle()

  if (currentError) return { ok: false, error: getSupabaseErrorMessage(currentError) }
  if (!current) return { ok: false, error: 'Labour type not found.' }

  const { data: siblings, error: siblingError } = await supabase
    .from('labour_types')
    .select('id')
    .ilike('name', current.name)

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
