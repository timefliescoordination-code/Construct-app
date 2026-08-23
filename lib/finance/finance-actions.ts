"use server"

import { revalidatePath } from "next/cache"
import { requireAdminSession } from "@/lib/auth/require-admin"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import type {
  CompanyExpense,
  CompanyIncome,
  PersonalExpense,
} from "@/lib/types/database"

export type FinanceActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function revalidateFinance() {
  revalidatePath("/admin/expenses")
}

const FINANCE_BULK_CHUNK = 200

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

export async function createCompanyIncomeAction(input: {
  category: string
  description: string
  amount: number
  sourceName?: string | null
  receivedDate: string
  paymentMethod?: string | null
  referenceNumber?: string | null
  notes?: string | null
}): Promise<FinanceActionResult<CompanyIncome>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { data, error } = await session.supabase
    .from("company_income")
    .insert({
      category: input.category,
      description: input.description,
      amount: input.amount,
      source_name: input.sourceName ?? null,
      received_date: input.receivedDate,
      payment_method: input.paymentMethod ?? null,
      reference_number: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      created_by: session.userId,
    })
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinance()
  return { ok: true, data: data as CompanyIncome }
}

export async function updateCompanyIncomeAction(input: {
  id: string
  category: string
  description: string
  amount: number
  sourceName?: string | null
  receivedDate: string
  paymentMethod?: string | null
  referenceNumber?: string | null
  notes?: string | null
}): Promise<FinanceActionResult<CompanyIncome>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { data, error } = await session.supabase
    .from("company_income")
    .update({
      category: input.category,
      description: input.description,
      amount: input.amount,
      source_name: input.sourceName ?? null,
      received_date: input.receivedDate,
      payment_method: input.paymentMethod ?? null,
      reference_number: input.referenceNumber ?? null,
      notes: input.notes ?? null,
    })
    .eq("id", input.id)
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateFinance()
  return { ok: true, data: data as CompanyIncome }
}

export async function deleteCompanyIncomeAction(
  id: string,
): Promise<FinanceActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const { error } = await session.supabase
    .from("company_income")
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

export async function bulkCreateCompanyExpensesAction(input: {
  rows: Array<{
    category: string
    description: string
    amount: number
    vendorName?: string | null
    expenseDate: string
  }>
}): Promise<FinanceActionResult<{ created: number }>> {
  const session = await requireAdminSession()
  if (!session.ok) return session
  if (input.rows.length === 0) {
    return { ok: false, error: "No rows to save." }
  }

  let created = 0
  for (let i = 0; i < input.rows.length; i += FINANCE_BULK_CHUNK) {
    const chunk = input.rows.slice(i, i + FINANCE_BULK_CHUNK).map((row) => ({
      category: row.category,
      description: row.description,
      amount: row.amount,
      vendor_name: row.vendorName ?? null,
      expense_date: row.expenseDate,
      payment_method: null,
      notes: null,
      created_by: session.userId,
    }))
    const { error } = await session.supabase.from("company_expenses").insert(chunk)
    if (error) {
      return {
        ok: false,
        error: `${getSupabaseErrorMessage(error)} (${created} row(s) saved before failure)`,
      }
    }
    created += chunk.length
  }

  revalidateFinance()
  return { ok: true, data: { created } }
}

export async function bulkCreateCompanyIncomeAction(input: {
  rows: Array<{
    category: string
    description: string
    amount: number
    sourceName?: string | null
    receivedDate: string
  }>
}): Promise<FinanceActionResult<{ created: number }>> {
  const session = await requireAdminSession()
  if (!session.ok) return session
  if (input.rows.length === 0) {
    return { ok: false, error: "No rows to save." }
  }

  let created = 0
  for (let i = 0; i < input.rows.length; i += FINANCE_BULK_CHUNK) {
    const chunk = input.rows.slice(i, i + FINANCE_BULK_CHUNK).map((row) => ({
      category: row.category,
      description: row.description,
      amount: row.amount,
      source_name: row.sourceName ?? null,
      received_date: row.receivedDate,
      payment_method: null,
      reference_number: null,
      notes: null,
      created_by: session.userId,
    }))
    const { error } = await session.supabase.from("company_income").insert(chunk)
    if (error) {
      return {
        ok: false,
        error: `${getSupabaseErrorMessage(error)} (${created} row(s) saved before failure)`,
      }
    }
    created += chunk.length
  }

  revalidateFinance()
  return { ok: true, data: { created } }
}

export async function bulkCreatePersonalExpensesAction(input: {
  rows: Array<{
    category: string
    description: string
    amount: number
    expenseDate: string
  }>
}): Promise<FinanceActionResult<{ created: number }>> {
  const session = await requireAdminSession()
  if (!session.ok) return session
  if (input.rows.length === 0) {
    return { ok: false, error: "No rows to save." }
  }

  let created = 0
  for (let i = 0; i < input.rows.length; i += FINANCE_BULK_CHUNK) {
    const chunk = input.rows.slice(i, i + FINANCE_BULK_CHUNK).map((row) => ({
      category: row.category,
      description: row.description,
      amount: row.amount,
      expense_date: row.expenseDate,
      notes: null,
      created_by: session.userId,
    }))
    const { error } = await session.supabase.from("personal_expenses").insert(chunk)
    if (error) {
      return {
        ok: false,
        error: `${getSupabaseErrorMessage(error)} (${created} row(s) saved before failure)`,
      }
    }
    created += chunk.length
  }

  revalidateFinance()
  return { ok: true, data: { created } }
}
