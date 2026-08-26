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

/** Seed the company list if it is empty. Does not touch projects. */
export async function ensureGlobalLabourTypesSeeded(
  supabase: SupabaseServerClient,
): Promise<LabourTypeCatalogResult<LabourType[]>> {
  const existing = await listGlobalLabourTypes(supabase)
  if (!existing.ok) return existing
  if (existing.data.length > 0) return existing

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
  return listGlobalLabourTypes(supabase)
}

async function copyMissingTypesToProjects(
  supabase: SupabaseServerClient,
  types: Array<Pick<LabourType, 'name' | 'short_label' | 'default_wage' | 'sort_order'>>,
): Promise<LabourTypeCatalogResult> {
  if (!types.length) return { ok: true, data: undefined }

  const projects = await listProjectIds(supabase)
  if (projects.error) return { ok: false, error: projects.error }
  if (!projects.ids.length) return { ok: true, data: undefined }

  const { data: existingRows, error: existingError } = await supabase
    .from('labour_types')
    .select('project_id, name')
    .in('project_id', projects.ids)

  if (existingError) return { ok: false, error: getSupabaseErrorMessage(existingError) }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) => `${row.project_id}:${nameKey(String(row.name))}`),
  )

  const inserts = projects.ids.flatMap((projectId) =>
    types
      .filter((type) => !existingKeys.has(`${projectId}:${nameKey(type.name)}`))
      .map((type) => ({
        project_id: projectId,
        name: type.name.trim(),
        short_label: type.short_label,
        default_wage: Number(type.default_wage),
        sort_order: Number(type.sort_order ?? 0),
      })),
  )

  if (inserts.length) {
    const { error: insertError } = await supabase.from('labour_types').insert(inserts)
    if (insertError) return { ok: false, error: getSupabaseErrorMessage(insertError) }
  }

  const typeNames = types.map((type) => type.name.trim())
  const { data: projectTypes, error: typesError } = await supabase
    .from('labour_types')
    .select('id, project_id, name, default_wage')
    .in('project_id', projects.ids)

  if (typesError) return { ok: false, error: getSupabaseErrorMessage(typesError) }

  const wanted = new Set(typeNames.map(nameKey))
  const typeByProjectName = new Map<string, { id: string; defaultWage: number }>()
  for (const row of projectTypes ?? []) {
    if (!wanted.has(nameKey(String(row.name)))) continue
    typeByProjectName.set(`${row.project_id}:${nameKey(String(row.name))}`, {
      id: row.id as string,
      defaultWage: Number(row.default_wage),
    })
  }

  const { data: weeks, error: weeksError } = await supabase
    .from('manpower_weeks')
    .select('id, project_id')
    .in('project_id', projects.ids)

  if (weeksError) return { ok: false, error: getSupabaseErrorMessage(weeksError) }
  if (!weeks?.length) return { ok: true, data: undefined }

  const rates = weeks.flatMap((week) =>
    types
      .map((type) => typeByProjectName.get(`${week.project_id}:${nameKey(type.name)}`))
      .filter((row): row is { id: string; defaultWage: number } => Boolean(row))
      .map((row) => ({
        week_id: week.id,
        labour_type_id: row.id,
        daily_rate: row.defaultWage,
      })),
  )

  if (!rates.length) return { ok: true, data: undefined }

  const { error: ratesError } = await supabase
    .from('manpower_week_rates')
    .upsert(rates, { onConflict: 'week_id,labour_type_id' })
  if (ratesError) return { ok: false, error: getSupabaseErrorMessage(ratesError) }
  return { ok: true, data: undefined }
}

export async function listLabourTypesForProject(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<LabourTypeCatalogResult<LabourType[]>> {
  const { data, error } = await supabase
    .from('labour_types')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  if (data?.length) return { ok: true, data: asLabourTypes(data) }

  const catalog = await ensureGlobalLabourTypesSeeded(supabase)
  if (!catalog.ok) return catalog
  if (!catalog.data.length) return { ok: true, data: [] }

  const copied = await copyMissingTypesToProjects(supabase, catalog.data)
  if (!copied.ok) return copied

  const { data: copiedRows, error: copiedError } = await supabase
    .from('labour_types')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (copiedError) return { ok: false, error: getSupabaseErrorMessage(copiedError) }
  return { ok: true, data: asLabourTypes(copiedRows) }
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

  const catalog = await ensureGlobalLabourTypesSeeded(supabase)
  if (!catalog.ok) return catalog

  if (catalog.data.some((row) => nameKey(row.name) === nameKey(name))) {
    return { ok: false, error: 'A labour type with this name already exists.' }
  }

  const lastOrder = catalog.data.reduce(
    (max, row) => Math.max(max, Number(row.sort_order ?? 0)),
    0,
  )
  const sortOrder = lastOrder + 1

  const { data, error } = await supabase
    .from('labour_types')
    .insert({
      project_id: null,
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

  const copied = await copyMissingTypesToProjects(supabase, [
    {
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
      sort_order: sortOrder,
    },
  ])
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

  const { error } = await supabase
    .from('labour_types')
    .update({
      name,
      short_label: shortLabel,
      default_wage: defaultWage,
    })
    .ilike('name', current.name as string)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
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
