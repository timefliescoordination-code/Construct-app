import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_EXPENSE_CATEGORIES } from '@/lib/expense-categories/constants'
import {
  EXPENSE_INPUT_MIGRATIONS_HINT,
  isMissingExpenseInputCatalogError,
} from '@/lib/expense-input/db'
import type {
  ExpenseCategoriesPayload,
  ExpenseCategoryView,
} from '@/lib/data/expense-categories'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

type CatalogCategoryRow = {
  id: string
  name: string
  uses_labour_teams: boolean
  sort_order: number
}

type CatalogSubcategoryRow = {
  id: string
  category_id: string
  name: string
  sort_order: number
}

function mapCatalog(
  categories: CatalogCategoryRow[],
  subcategories: CatalogSubcategoryRow[],
): ExpenseCategoryView[] {
  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    usesLabourTeams: Boolean(cat.uses_labour_teams),
    subcategories: subcategories
      .filter((s) => s.category_id === cat.id)
      .map((s) => ({ id: s.id, name: s.name })),
  }))
}

async function seedMasterCatalog(
  supabase: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const [index, cat] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    const { data: inserted, error: catError } = await supabase
      .from('expense_input_categories')
      .insert({
        name: cat.name,
        uses_labour_teams: cat.usesLabourTeams,
        sort_order: index + 1,
      })
      .select('id')
      .single()

    if (catError || !inserted) {
      if (catError && isMissingExpenseInputCatalogError(catError)) {
        return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT }
      }
      return {
        ok: false,
        error: catError
          ? getSupabaseErrorMessage(catError)
          : 'Failed to seed expense input categories.',
      }
    }

    if (cat.subcategories.length === 0) continue

    const { error: subError } = await supabase.from('expense_input_subcategories').insert(
      cat.subcategories.map((name, subIndex) => ({
        category_id: inserted.id,
        name,
        sort_order: subIndex + 1,
      })),
    )
    if (subError) {
      return { ok: false, error: getSupabaseErrorMessage(subError) }
    }
  }

  return { ok: true }
}

export async function loadMasterExpenseInputCatalog(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; data: ExpenseCategoriesPayload; missingTable?: false }
  | { ok: false; error: string; missingTable?: boolean }
> {
  const { data: categories, error: categoriesError } = await supabase
    .from('expense_input_categories')
    .select('id, name, uses_labour_teams, sort_order')
    .order('sort_order', { ascending: true })

  if (categoriesError) {
    if (isMissingExpenseInputCatalogError(categoriesError)) {
      return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT, missingTable: true }
    }
    return { ok: false, error: getSupabaseErrorMessage(categoriesError) }
  }

  if (!categories?.length) {
    const seeded = await seedMasterCatalog(supabase)
    if (!seeded.ok) return seeded
    return loadMasterExpenseInputCatalog(supabase)
  }

  const categoryIds = categories.map((c) => c.id)
  const { data: subs, error: subsError } = await supabase
    .from('expense_input_subcategories')
    .select('id, category_id, name, sort_order')
    .in('category_id', categoryIds)
    .order('sort_order', { ascending: true })

  if (subsError) {
    if (isMissingExpenseInputCatalogError(subsError)) {
      return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT, missingTable: true }
    }
    return { ok: false, error: getSupabaseErrorMessage(subsError) }
  }

  return {
    ok: true,
    data: {
      categories: mapCatalog(categories as CatalogCategoryRow[], (subs ?? []) as CatalogSubcategoryRow[]),
    },
  }
}
