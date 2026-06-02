"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import type { CompanyExpense, PersonalExpense } from "@/lib/types/database"

export type FinanceActionResult<T = void> =
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

  return { ok: true as const, supabase, userId: user.id }
}

function revalidateFinance() {
  revalidatePath("/admin/expenses")
}

export async function createCompanyExpenseAction(input: {
  category: string
  description: string
  amount: number
  vendorName?: string | null
  expenseDate: string
  paymentMethod?: string | null
  notes?: string | null
}): Promise<FinanceActionResult<CompanyExpense>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { data, error } = await session.supabase
    .from("company_expenses")
    .insert({
      category: input.category,
      description: input.description,
      amount: input.amount,
      vendor_name: input.vendorName ?? null,
      expense_date: input.expenseDate,
      payment_method: input.paymentMethod ?? null,
      notes: input.notes ?? null,
      created_by: session.userId,
    })
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinance()
  return { ok: true, data: data as CompanyExpense }
}

export async function updateCompanyExpenseAction(input: {
  id: string
  category: string
  description: string
  amount: number
  vendorName?: string | null
  expenseDate: string
  paymentMethod?: string | null
  notes?: string | null
}): Promise<FinanceActionResult<CompanyExpense>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { data, error } = await session.supabase
    .from("company_expenses")
    .update({
      category: input.category,
      description: input.description,
      amount: input.amount,
      vendor_name: input.vendorName ?? null,
      expense_date: input.expenseDate,
      payment_method: input.paymentMethod ?? null,
      notes: input.notes ?? null,
    })
    .eq("id", input.id)
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinance()
  return { ok: true, data: data as CompanyExpense }
}

export async function deleteCompanyExpenseAction(
  id: string,
): Promise<FinanceActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { error } = await session.supabase
    .from("company_expenses")
    .delete()
    .eq("id", id)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinance()
  return { ok: true, data: undefined }
}

export async function createPersonalExpenseAction(input: {
  category: string
  description: string
  amount: number
  expenseDate: string
  notes?: string | null
}): Promise<FinanceActionResult<PersonalExpense>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { data, error } = await session.supabase
    .from("personal_expenses")
    .insert({
      category: input.category,
      description: input.description,
      amount: input.amount,
      expense_date: input.expenseDate,
      notes: input.notes ?? null,
      created_by: session.userId,
    })
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinance()
  return { ok: true, data: data as PersonalExpense }
}

export async function updatePersonalExpenseAction(input: {
  id: string
  category: string
  description: string
  amount: number
  expenseDate: string
  notes?: string | null
}): Promise<FinanceActionResult<PersonalExpense>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { data, error } = await session.supabase
    .from("personal_expenses")
    .update({
      category: input.category,
      description: input.description,
      amount: input.amount,
      expense_date: input.expenseDate,
      notes: input.notes ?? null,
    })
    .eq("id", input.id)
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinance()
  return { ok: true, data: data as PersonalExpense }
}

export async function deletePersonalExpenseAction(
  id: string,
): Promise<FinanceActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { error } = await session.supabase
    .from("personal_expenses")
    .delete()
    .eq("id", id)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinance()
  return { ok: true, data: undefined }
}
