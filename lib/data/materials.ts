import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import type {
  MaterialAlias,
  MaterialMaster,
  MaterialMasterWithAliases,
} from '@/lib/types/database'

export type MaterialMasterInput = {
  materialName: string
  category?: string | null
  averageRate?: number
  latestRate?: number
}

export type MaterialMasterUpdateInput = {
  materialName?: string
  category?: string | null
  averageRate?: number
  latestRate?: number
  purchaseCount?: number
}

export type MaterialAliasInput = {
  materialId: string
  aliasName: string
}

function normalizeMaterialName(name: string): string {
  return name.trim()
}

function attachAliases(
  materials: MaterialMaster[],
  aliases: MaterialAlias[],
): MaterialMasterWithAliases[] {
  const aliasesByMaterial = new Map<string, MaterialAlias[]>()

  for (const alias of aliases) {
    const existing = aliasesByMaterial.get(alias.material_id) ?? []
    existing.push(alias)
    aliasesByMaterial.set(alias.material_id, existing)
  }

  return materials.map((material) => ({
    ...material,
    aliases: aliasesByMaterial.get(material.id) ?? [],
  }))
}

async function fetchAliasesForMaterials(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materialIds: string[],
): Promise<{ aliases: MaterialAlias[]; error: string | null }> {
  if (materialIds.length === 0) {
    return { aliases: [], error: null }
  }

  const { data, error } = await supabase
    .from('material_aliases')
    .select('*')
    .in('material_id', materialIds)
    .order('alias_name', { ascending: true })

  if (error) {
    return { aliases: [], error: getSupabaseErrorMessage(error) }
  }

  return { aliases: (data ?? []) as MaterialAlias[], error: null }
}

export async function listMaterialMaster(options?: { category?: string }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view materials.' }
  }

  let query = supabase
    .from('material_master')
    .select('*')
    .order('material_name', { ascending: true })

  if (options?.category) {
    query = query.eq('category', options.category)
  }

  const { data: materials, error: materialsError } = await query

  if (materialsError) {
    return { data: null, error: getSupabaseErrorMessage(materialsError) }
  }

  const materialRows = (materials ?? []) as MaterialMaster[]
  const { aliases, error: aliasesError } = await fetchAliasesForMaterials(
    supabase,
    materialRows.map((m) => m.id),
  )

  if (aliasesError) {
    return { data: null, error: aliasesError }
  }

  return { data: attachAliases(materialRows, aliases), error: null }
}

export async function getMaterialMasterById(materialId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view materials.' }
  }

  const { data: material, error: materialError } = await supabase
    .from('material_master')
    .select('*')
    .eq('id', materialId)
    .maybeSingle()

  if (materialError) {
    return { data: null, error: getSupabaseErrorMessage(materialError) }
  }

  if (!material) {
    return { data: null, error: 'Material not found.' }
  }

  const { aliases, error: aliasesError } = await fetchAliasesForMaterials(supabase, [
    materialId,
  ])

  if (aliasesError) {
    return { data: null, error: aliasesError }
  }

  return {
    data: attachAliases([material as MaterialMaster], aliases)[0],
    error: null,
  }
}

export async function resolveMaterialByAlias(aliasName: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to resolve materials.' }
  }

  const normalizedAlias = normalizeMaterialName(aliasName)
  if (!normalizedAlias) {
    return { data: null, error: 'Alias name is required.' }
  }

  const { data: aliasRows, error: aliasError } = await supabase
    .from('material_aliases')
    .select('*, material:material_master(*)')
    .ilike('alias_name', normalizedAlias)
    .limit(1)

  if (aliasError) {
    return { data: null, error: getSupabaseErrorMessage(aliasError) }
  }

  const alias = aliasRows?.[0] as
    | (MaterialAlias & { material: MaterialMaster | null })
    | undefined

  if (!alias?.material) {
    return { data: null, error: null }
  }

  return { data: alias.material, error: null }
}

export async function createMaterialMaster(input: MaterialMasterInput) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to create materials.' }
  }

  const materialName = normalizeMaterialName(input.materialName)
  if (!materialName) {
    return { data: null, error: 'Material name is required.' }
  }

  const { data, error } = await supabase
    .from('material_master')
    .insert({
      material_name: materialName,
      category: input.category?.trim() || null,
      average_rate: input.averageRate ?? 0,
      latest_rate: input.latestRate ?? 0,
    })
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: data as MaterialMaster, error: null }
}

export async function updateMaterialMaster(
  materialId: string,
  input: MaterialMasterUpdateInput,
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to update materials.' }
  }

  const updates: Record<string, string | number | null> = {}

  if (input.materialName !== undefined) {
    const materialName = normalizeMaterialName(input.materialName)
    if (!materialName) {
      return { data: null, error: 'Material name cannot be empty.' }
    }
    updates.material_name = materialName
  }

  if (input.category !== undefined) {
    updates.category = input.category?.trim() || null
  }

  if (input.averageRate !== undefined) {
    updates.average_rate = input.averageRate
  }

  if (input.latestRate !== undefined) {
    updates.latest_rate = input.latestRate
  }

  if (input.purchaseCount !== undefined) {
    updates.purchase_count = input.purchaseCount
  }

  if (Object.keys(updates).length === 0) {
    return getMaterialMasterById(materialId)
  }

  const { data, error } = await supabase
    .from('material_master')
    .update(updates)
    .eq('id', materialId)
    .select('*')
    .maybeSingle()

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  if (!data) {
    return { data: null, error: 'Material not found.' }
  }

  return { data: data as MaterialMaster, error: null }
}

export async function deleteMaterialMaster(materialId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to delete materials.' }
  }

  const { error } = await supabase.from('material_master').delete().eq('id', materialId)

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: true, error: null }
}

export async function listMaterialAliases(materialId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view material aliases.' }
  }

  const { data, error } = await supabase
    .from('material_aliases')
    .select('*')
    .eq('material_id', materialId)
    .order('alias_name', { ascending: true })

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: (data ?? []) as MaterialAlias[], error: null }
}

export async function createMaterialAlias(input: MaterialAliasInput) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to create material aliases.' }
  }

  const aliasName = normalizeMaterialName(input.aliasName)
  if (!aliasName) {
    return { data: null, error: 'Alias name is required.' }
  }

  const { data, error } = await supabase
    .from('material_aliases')
    .insert({
      material_id: input.materialId,
      alias_name: aliasName,
    })
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: data as MaterialAlias, error: null }
}

export async function deleteMaterialAlias(aliasId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to delete material aliases.' }
  }

  const { error } = await supabase.from('material_aliases').delete().eq('id', aliasId)

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: true, error: null }
}

export async function recordMaterialPurchase(
  materialId: string,
  purchaseRate: number,
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to record material purchases.' }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('material_master')
    .select('average_rate, latest_rate, purchase_count')
    .eq('id', materialId)
    .maybeSingle()

  if (fetchError) {
    return { data: null, error: getSupabaseErrorMessage(fetchError) }
  }

  if (!existing) {
    return { data: null, error: 'Material not found.' }
  }

  const purchaseCount = Number(existing.purchase_count) + 1
  const averageRate =
    purchaseCount === 1
      ? purchaseRate
      : (Number(existing.average_rate) * Number(existing.purchase_count) + purchaseRate) /
        purchaseCount

  return updateMaterialMaster(materialId, {
    averageRate,
    latestRate: purchaseRate,
    purchaseCount,
  })
}
