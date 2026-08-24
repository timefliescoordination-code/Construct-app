'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminSession } from '@/lib/auth/require-admin'
import { loadMasterExpenseInputCatalog } from '@/lib/data/expense-input-catalog'
import type { ExpenseCategoriesPayload } from '@/lib/data/expense-categories'
import { EXPENSE_INPUT_MIGRATIONS_HINT, isMissingExpenseInputCatalogError } from '@/lib/expense-input/db'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export type ExpenseInputActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function revalidateCatalog() {
  revalidatePath('/admin/settings/expense-input')
  revalidatePath('/projects')
}

export async function getExpenseInputCatalogAction(): Promise<
  ExpenseInputActionResult<ExpenseCategoriesPayload>
> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const result = await loadMasterExpenseInputCatalog(session.supabase)
  if (!result.ok) return result
  return { ok: true, data: result.data }
}

export async function createExpenseInputCategoryAction(input: {
  name: string
  usesLabourTeams?: boolean
}): Promise<ExpenseInputActionResult<{ id: string; name: string }>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Category name is required.' }

  const { data: last } = await session.supabase
    .from('expense_input_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await session.supabase
    .from('expense_input_categories')
    .insert({
      name,
      uses_labour_teams: input.usesLabourTeams ?? false,
      sort_order: Number(last?.sort_order ?? 0) + 1,
    })
    .select('id, name')
    .single()

  if (error || !data) {
    if (error && isMissingExpenseInputCatalogError(error)) {
      return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT }
    }
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to create category.',
    }
  }

  revalidateCatalog()
  return { ok: true, data: { id: data.id, name: data.name } }
}

export async function updateExpenseInputCategoryAction(input: {
  categoryId: string
  name: string
  usesLabourTeams?: boolean
}): Promise<ExpenseInputActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Category name is required.' }

  const patch: { name: string; uses_labour_teams?: boolean } = { name }
  if (typeof input.usesLabourTeams === 'boolean') {
    patch.uses_labour_teams = input.usesLabourTeams
  }

  const { error } = await session.supabase
    .from('expense_input_categories')
    .update(patch)
    .eq('id', input.categoryId)

  if (error) {
    if (isMissingExpenseInputCatalogError(error)) {
      return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT }
    }
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateCatalog()
  return { ok: true, data: undefined }
}

export async function deleteExpenseInputCategoryAction(input: {
  categoryId: string
}): Promise<ExpenseInputActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { error } = await session.supabase
    .from('expense_input_categories')
    .delete()
    .eq('id', input.categoryId)

  if (error) {
    if (isMissingExpenseInputCatalogError(error)) {
      return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT }
    }
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateCatalog()
  return { ok: true, data: undefined }
}

export async function createExpenseInputSubcategoryAction(input: {
  categoryId: string
  name: string
}): Promise<ExpenseInputActionResult<{ id: string; name: string }>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Subcategory name is required.' }

  const { data: category } = await session.supabase
    .from('expense_input_categories')
    .select('uses_labour_teams')
    .eq('id', input.categoryId)
    .maybeSingle()

  if (!category) return { ok: false, error: 'Category not found.' }
  if (category.uses_labour_teams) {
    return {
      ok: false,
      error: 'Labour categories use labour teams on each project instead of subcategories.',
    }
  }

  const { data: last } = await session.supabase
    .from('expense_input_subcategories')
    .select('sort_order')
    .eq('category_id', input.categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await session.supabase
    .from('expense_input_subcategories')
    .insert({
      category_id: input.categoryId,
      name,
      sort_order: Number(last?.sort_order ?? 0) + 1,
    })
    .select('id, name')
    .single()

  if (error || !data) {
    if (error && isMissingExpenseInputCatalogError(error)) {
      return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT }
    }
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to create subcategory.',
    }
  }

  revalidateCatalog()
  return { ok: true, data: { id: data.id, name: data.name } }
}

export async function updateExpenseInputSubcategoryAction(input: {
  subcategoryId: string
  name: string
}): Promise<ExpenseInputActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Subcategory name is required.' }

  const { error } = await session.supabase
    .from('expense_input_subcategories')
    .update({ name })
    .eq('id', input.subcategoryId)

  if (error) {
    if (isMissingExpenseInputCatalogError(error)) {
      return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT }
    }
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateCatalog()
  return { ok: true, data: undefined }
}

export async function deleteExpenseInputSubcategoryAction(input: {
  subcategoryId: string
}): Promise<ExpenseInputActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { error } = await session.supabase
    .from('expense_input_subcategories')
    .delete()
    .eq('id', input.subcategoryId)

  if (error) {
    if (isMissingExpenseInputCatalogError(error)) {
      return { ok: false, error: EXPENSE_INPUT_MIGRATIONS_HINT }
    }
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateCatalog()
  return { ok: true, data: undefined }
}
