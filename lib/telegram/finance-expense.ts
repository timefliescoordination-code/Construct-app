import {
  COMPANY_EXPENSE_CATEGORIES,
  PERSONAL_EXPENSE_CATEGORIES,
} from '@/lib/finance/categories'
import { createAdminClient } from '@/lib/supabase/server'
import type { ExpenseSessionPayload } from '@/lib/telegram/types'
import { formatINR } from '@/lib/currency'

export async function listTelegramFinanceCategories(
  kind: 'company_expense' | 'personal_expense',
): Promise<string[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('finance_categories')
    .select('name')
    .eq('kind', kind)
    .order('name')

  if (!error && data?.length) {
    return data.map((row) => row.name)
  }

  return kind === 'company_expense'
    ? [...COMPANY_EXPENSE_CATEGORIES]
    : [...PERSONAL_EXPENSE_CATEGORIES]
}

export async function createTelegramCompanyExpense(input: {
  profileId: string
  category: string
  description: string
  amount: number
  vendorName?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase.from('company_expenses').insert({
    category: input.category,
    description: input.description,
    amount: input.amount,
    vendor_name: input.vendorName ?? null,
    expense_date: today,
    payment_method: null,
    notes: 'Submitted via Telegram',
    created_by: input.profileId,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function createTelegramPersonalExpense(input: {
  profileId: string
  category: string
  description: string
  amount: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase.from('personal_expenses').insert({
    category: input.category,
    description: input.description,
    amount: input.amount,
    expense_date: today,
    notes: 'Submitted via Telegram',
    created_by: input.profileId,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export function formatFinanceExpenseSummary(payload: ExpenseSessionPayload): string {
  const typeLabel =
    payload.expenseType === 'company'
      ? 'Company expense'
      : payload.expenseType === 'personal'
        ? 'Personal expense'
        : 'Expense'

  return [
    `Please confirm this ${typeLabel.toLowerCase()}:`,
    '',
    `Category: ${payload.category ?? '—'}`,
    `Amount: ${payload.amount != null ? formatINR(payload.amount) : '—'}`,
    `Description: ${payload.description ?? '—'}`,
    payload.vendorName ? `Vendor: ${payload.vendorName}` : null,
    '',
    'Submit? (yes / no)',
  ]
    .filter(Boolean)
    .join('\n')
}

function matchCategoryToken(token: string, categories: string[]): string | null {
  const normalized = token.toLowerCase().replace(/\s+/g, '')
  return (
    categories.find(
      (c) => c.toLowerCase().replace(/\s+/g, '') === normalized,
    ) ??
    categories.find((c) => c.toLowerCase().startsWith(token.toLowerCase())) ??
    null
  )
}

/** Admin quick: `company 5000 Office Rent June rent` */
export function parseAdminCompanyQuick(
  text: string,
  categories?: string[],
): {
  amount: number
  category: string
  description: string
} | null {
  const match = text.trim().match(/^company\s+(\d+(?:\.\d{1,2})?)\s+(\S+)\s+(.+)$/i)
  if (!match) return null
  const amount = Number(match[1])
  const categoryToken = match[2]
  const description = match[3].trim()
  if (!Number.isFinite(amount) || amount <= 0 || !description) return null

  const pool = categories?.length ? categories : [...COMPANY_EXPENSE_CATEGORIES]
  const category = matchCategoryToken(categoryToken, pool)
  if (!category) return null
  return { amount, category, description }
}

/** Admin quick: `personal 200 Food Lunch meeting` */
export function parseAdminPersonalQuick(
  text: string,
  categories?: string[],
): {
  amount: number
  category: string
  description: string
} | null {
  const match = text.trim().match(/^personal\s+(\d+(?:\.\d{1,2})?)\s+(\S+)\s+(.+)$/i)
  if (!match) return null
  const amount = Number(match[1])
  const categoryToken = match[2]
  const description = match[3].trim()
  if (!Number.isFinite(amount) || amount <= 0 || !description) return null

  const pool = categories?.length ? categories : [...PERSONAL_EXPENSE_CATEGORIES]
  const category = matchCategoryToken(categoryToken, pool)
  if (!category) return null
  return { amount, category, description }
}
