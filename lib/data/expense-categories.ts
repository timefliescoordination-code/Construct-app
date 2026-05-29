import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { DEFAULT_EXPENSE_CATEGORIES } from '@/lib/expense-categories/constants'

export type ExpenseSubcategoryView = {
  id: string
  name: string
}

export type ExpenseCategoryView = {
  id: string
  name: string
  usesLabourTeams: boolean
  subcategories: ExpenseSubcategoryView[]
}

export type ExpenseCategoriesPayload = {
  categories: ExpenseCategoryView[]
}

async function ensureProjectExpenseCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: existingError } = await supabase
    .from('expense_categories')
    .select('id')
    .eq('project_id', projectId)
    .limit(1)

  if (existingError) {
    return { ok: false, error: getSupabaseErrorMessage(existingError) }
  }

  if (existing?.length) return { ok: true }

  for (const [index, cat] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    const { data: inserted, error: catError } = await supabase
      .from('expense_categories')
      .insert({
        project_id: projectId,
        name: cat.name,
        uses_labour_teams: cat.usesLabourTeams,
        sort_order: index + 1,
      })
      .select('id')
      .single()

    if (catError || !inserted) {
      return {
        ok: false,
        error: catError
          ? getSupabaseErrorMessage(catError)
          : 'Failed to seed expense categories.',
      }
    }

    if (cat.subcategories.length > 0) {
      const { error: subError } = await supabase.from('expense_subcategories').insert(
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
  }

  return { ok: true }
}

export async function getExpenseCategoriesForProject(projectId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view expense categories.' }
  }

  const ensured = await ensureProjectExpenseCategories(supabase, projectId)
  if (!ensured.ok) {
    return { data: null, error: ensured.error }
  }

  const { data: categories, error: categoriesError } = await supabase
    .from('expense_categories')
    .select('id, name, uses_labour_teams, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (categoriesError) {
    return { data: null, error: getSupabaseErrorMessage(categoriesError) }
  }

  const categoryIds = (categories ?? []).map((c) => c.id)
  let subcategories: { id: string; category_id: string; name: string; sort_order: number }[] =
    []

  if (categoryIds.length > 0) {
    const { data: subs, error: subsError } = await supabase
      .from('expense_subcategories')
      .select('id, category_id, name, sort_order')
      .in('category_id', categoryIds)
      .order('sort_order', { ascending: true })

    if (subsError) {
      return { data: null, error: getSupabaseErrorMessage(subsError) }
    }
    subcategories = subs ?? []
  }

  const payload: ExpenseCategoriesPayload = {
    categories: (categories ?? []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      usesLabourTeams: Boolean(cat.uses_labour_teams),
      subcategories: subcategories
        .filter((s) => s.category_id === cat.id)
        .map((s) => ({ id: s.id, name: s.name })),
    })),
  }

  return { data: payload, error: null }
}
