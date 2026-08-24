"use server"

import { revalidatePath } from "next/cache"
import { requireAdminSession } from "@/lib/auth/require-admin"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import {
  FINANCE_MIGRATIONS_HINT,
  isMissingFinanceTableError,
} from "@/lib/finance/finance-db"
import type { FinanceCategory, FinanceCategoryKind } from "@/lib/types/database"

export type FinanceCategoryActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function revalidateFinanceCategories() {
  revalidatePath("/admin/expenses")
  revalidatePath("/admin/settings/expense-input")
  revalidatePath("/api/management/finance-categories")
}

export async function createFinanceCategoryAction(input: {
  kind: FinanceCategoryKind
  name: string
}): Promise<FinanceCategoryActionResult<FinanceCategory>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const name = input.name.trim()
  if (!name) return { ok: false, error: "Category name is required." }

  const { data: last } = await session.supabase
    .from("finance_categories")
    .select("sort_order")
    .eq("kind", input.kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await session.supabase
    .from("finance_categories")
    .insert({
      kind: input.kind,
      name,
      sort_order: Number(last?.sort_order ?? 0) + 1,
    })
    .select("*")
    .single()

  if (error) {
    return {
      ok: false,
      error: isMissingFinanceTableError(error)
        ? FINANCE_MIGRATIONS_HINT
        : getSupabaseErrorMessage(error),
    }
  }

  revalidateFinanceCategories()
  return { ok: true, data: data as FinanceCategory }
}

export async function updateFinanceCategoryAction(input: {
  id: string
  kind: FinanceCategoryKind
  name: string
}): Promise<FinanceCategoryActionResult<FinanceCategory>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const name = input.name.trim()
  if (!name) return { ok: false, error: "Category name is required." }

  const { data: existing, error: fetchError } = await session.supabase
    .from("finance_categories")
    .select("name")
    .eq("id", input.id)
    .eq("kind", input.kind)
    .single()

  if (fetchError || !existing) {
    return { ok: false, error: "Category not found." }
  }

  const { data, error } = await session.supabase
    .from("finance_categories")
    .update({ name })
    .eq("id", input.id)
    .eq("kind", input.kind)
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinanceCategories()
  revalidatePath("/admin/expenses")
  return { ok: true, data: data as FinanceCategory }
}

export async function deleteFinanceCategoryAction(input: {
  id: string
  kind: FinanceCategoryKind
}): Promise<FinanceCategoryActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { data: existing, error: fetchError } = await session.supabase
    .from("finance_categories")
    .select("name")
    .eq("id", input.id)
    .eq("kind", input.kind)
    .single()

  if (fetchError || !existing) {
    return { ok: false, error: "Category not found." }
  }

  const { count } = await session.supabase
    .from("finance_categories")
    .select("id", { count: "exact", head: true })
    .eq("kind", input.kind)

  if ((count ?? 0) <= 1) {
    return { ok: false, error: "Keep at least one category." }
  }

  const { error } = await session.supabase
    .from("finance_categories")
    .delete()
    .eq("id", input.id)
    .eq("kind", input.kind)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinanceCategories()
  return { ok: true, data: undefined }
}
