'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import type { UserRole } from '@/lib/types/database'

export type ExpenseCategoryActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function getSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, error: 'You must be signed in.' }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: getSupabaseErrorMessage(error) }
  }

  const role = (profile?.role ?? null) as UserRole | null
  if (!role) {
    return { ok: false as const, error: 'Your profile role is not set.' }
  }

  return { ok: true as const, supabase, role }
}

function canManageExpenseCategories(role: UserRole) {
  return role === 'admin'
}

const CATALOG_LOCKED_MESSAGE =
  'Categories and subcategories are managed in Settings → Manage expense input. Existing expenses are not changed.'

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/api/projects/${projectId}/expense-categories`)
}

export async function createExpenseCategoryAction(input: {
  projectId: string
  name: string
  usesLabourTeams?: boolean
}): Promise<ExpenseCategoryActionResult<{ id: string; name: string }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageExpenseCategories(session.role)) {
    return { ok: false, error: CATALOG_LOCKED_MESSAGE }
  }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Category name is required.' }

  const { data: last } = await session.supabase
    .from('expense_categories')
    .select('sort_order')
    .eq('project_id', input.projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await session.supabase
    .from('expense_categories')
    .insert({
      project_id: input.projectId,
      name,
      uses_labour_teams: input.usesLabourTeams ?? false,
      sort_order: Number(last?.sort_order ?? 0) + 1,
    })
    .select('id, name')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to create category.',
    }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: { id: data.id, name: data.name } }
}

export async function updateExpenseCategoryAction(input: {
  projectId: string
  categoryId: string
  name: string
}): Promise<ExpenseCategoryActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageExpenseCategories(session.role)) {
    return { ok: false, error: CATALOG_LOCKED_MESSAGE }
  }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Category name is required.' }

  const { error } = await session.supabase
    .from('expense_categories')
    .update({ name })
    .eq('id', input.categoryId)
    .eq('project_id', input.projectId)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function deleteExpenseCategoryAction(input: {
  projectId: string
  categoryId: string
}): Promise<ExpenseCategoryActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageExpenseCategories(session.role)) {
    return { ok: false, error: CATALOG_LOCKED_MESSAGE }
  }

  const { data: category } = await session.supabase
    .from('expense_categories')
    .select('name')
    .eq('id', input.categoryId)
    .eq('project_id', input.projectId)
    .maybeSingle()

  if (!category) return { ok: false, error: 'Category not found.' }

  const { count, error: countError } = await session.supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', input.projectId)
    .eq('category', category.name)

  if (countError) return { ok: false, error: getSupabaseErrorMessage(countError) }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: 'Cannot delete a category that already has expenses recorded.',
    }
  }

  const { error } = await session.supabase
    .from('expense_categories')
    .delete()
    .eq('id', input.categoryId)
    .eq('project_id', input.projectId)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function createExpenseSubcategoryAction(input: {
  projectId: string
  categoryId: string
  name: string
}): Promise<ExpenseCategoryActionResult<{ id: string; name: string }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageExpenseCategories(session.role)) {
    return { ok: false, error: CATALOG_LOCKED_MESSAGE }
  }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Subcategory name is required.' }

  const { data: category } = await session.supabase
    .from('expense_categories')
    .select('uses_labour_teams')
    .eq('id', input.categoryId)
    .eq('project_id', input.projectId)
    .maybeSingle()

  if (!category) return { ok: false, error: 'Category not found.' }
  if (category.uses_labour_teams) {
    return {
      ok: false,
      error: 'Labour categories use labour teams instead of subcategories.',
    }
  }

  const { data: last } = await session.supabase
    .from('expense_subcategories')
    .select('sort_order')
    .eq('category_id', input.categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await session.supabase
    .from('expense_subcategories')
    .insert({
      category_id: input.categoryId,
      name,
      sort_order: Number(last?.sort_order ?? 0) + 1,
    })
    .select('id, name')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: error ? getSupabaseErrorMessage(error) : 'Failed to create subcategory.',
    }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: { id: data.id, name: data.name } }
}

export async function updateExpenseSubcategoryAction(input: {
  projectId: string
  subcategoryId: string
  name: string
}): Promise<ExpenseCategoryActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageExpenseCategories(session.role)) {
    return { ok: false, error: CATALOG_LOCKED_MESSAGE }
  }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Subcategory name is required.' }

  const { error } = await session.supabase
    .from('expense_subcategories')
    .update({ name })
    .eq('id', input.subcategoryId)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}

export async function deleteExpenseSubcategoryAction(input: {
  projectId: string
  subcategoryId: string
}): Promise<ExpenseCategoryActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canManageExpenseCategories(session.role)) {
    return { ok: false, error: CATALOG_LOCKED_MESSAGE }
  }

  const { error } = await session.supabase
    .from('expense_subcategories')
    .delete()
    .eq('id', input.subcategoryId)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  revalidateProject(input.projectId)
  return { ok: true, data: undefined }
}
