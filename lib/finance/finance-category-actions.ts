"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import type { FinanceCategory, FinanceCategoryKind } from "@/lib/types/database"

export type FinanceCategoryActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function requireAdminSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, error: "You must be signed in." }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: getSupabaseErrorMessage(error) }
  }

  if (profile?.role !== "admin") {
    return { ok: false as const, error: "Admin access required." }
  }

  return { ok: true as const, supabase }
}

function revalidateFinanceCategories() {
  revalidatePath("/admin/expenses")
  revalidatePath("/api/admin/finance-categories")
}

async function categoryInUse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: FinanceCategoryKind,
  name: string,
): Promise<boolean> {
  if (kind === "company_expense") {
    const { count } = await supabase
      .from("company_expenses")
      .select("id", { count: "exact", head: true })
      .eq("category", name)
    return (count ?? 0) > 0
  }
  if (kind === "company_income") {
    const { count } = await supabase
      .from("company_income")
      .select("id", { count: "exact", head: true })
      .eq("category", name)
    return (count ?? 0) > 0
  }
  const { count } = await supabase
    .from("personal_expenses")
    .select("id", { count: "exact", head: true })
    .eq("category", name)
  return (count ?? 0) > 0
}

async function renameCategoryOnEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: FinanceCategoryKind,
  oldName: string,
  newName: string,
) {
  if (kind === "company_expense") {
    await supabase
      .from("company_expenses")
      .update({ category: newName })
      .eq("category", oldName)
  } else if (kind === "company_income") {
    await supabase
      .from("company_income")
      .update({ category: newName })
      .eq("category", oldName)
  } else {
    await supabase
      .from("personal_expenses")
      .update({ category: newName })
      .eq("category", oldName)
  }
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
    return { ok: false, error: getSupabaseErrorMessage(error) }
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

  const oldName = existing.name as string
  if (oldName !== name) {
    await renameCategoryOnEntries(session.supabase, input.kind, oldName, name)
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

  const inUse = await categoryInUse(
    session.supabase,
    input.kind,
    existing.name as string,
  )
  if (inUse) {
    return {
      ok: false,
      error: "Cannot delete a category that is used on existing entries.",
    }
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
