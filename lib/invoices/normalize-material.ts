import type { SupabaseClient } from '@supabase/supabase-js'
import type { MaterialMaster } from '@/lib/types/database'

export type MaterialLookupEntry = {
  materialId: string
  materialName: string
}

export type MaterialNormalizationResult =
  | {
      matched: true
      materialId: string
      standardizedName: string
    }
  | {
      matched: false
      standardizedName: null
    }

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function buildMaterialLookup(
  supabase: SupabaseClient,
): Promise<Map<string, MaterialLookupEntry>> {
  const lookup = new Map<string, MaterialLookupEntry>()

  const [{ data: materials }, { data: aliases }] = await Promise.all([
    supabase.from('material_master').select('id, material_name'),
    supabase.from('material_aliases').select('alias_name, material_id'),
  ])

  for (const material of (materials ?? []) as Pick<MaterialMaster, 'id' | 'material_name'>[]) {
    lookup.set(normalizeLookupKey(material.material_name), {
      materialId: material.id,
      materialName: material.material_name,
    })
  }

  if (aliases?.length) {
    const materialNameById = new Map(
      ((materials ?? []) as Pick<MaterialMaster, 'id' | 'material_name'>[]).map((material) => [
        material.id,
        material.material_name,
      ]),
    )

    for (const alias of aliases) {
      const materialName = materialNameById.get(alias.material_id as string)
      if (!materialName) continue
      lookup.set(normalizeLookupKey(alias.alias_name as string), {
        materialId: alias.material_id as string,
        materialName,
      })
    }
  }

  return lookup
}

export function normalizeMaterialDescription(
  description: string,
  lookup: Map<string, MaterialLookupEntry>,
): MaterialNormalizationResult {
  const match = lookup.get(normalizeLookupKey(description))
  if (!match) {
    return { matched: false, standardizedName: null }
  }

  return {
    matched: true,
    materialId: match.materialId,
    standardizedName: match.materialName,
  }
}

export function registerMaterialAliasInLookup(
  lookup: Map<string, MaterialLookupEntry>,
  aliasName: string,
  materialId: string,
  materialName: string,
): void {
  lookup.set(normalizeLookupKey(aliasName), { materialId, materialName })
}
