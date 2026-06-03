import { formatINR } from '@/lib/currency'
import { DEFAULT_EXPENSE_CATEGORIES } from '@/lib/expense-categories/constants'
import { uploadExpenseInvoiceFile } from '@/lib/invoices/storage'
import { createAdminClient } from '@/lib/supabase/server'
import type { ExpenseSessionPayload } from '@/lib/telegram/types'
import type { UserRole } from '@/lib/types/database'

export const TELEGRAM_EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name)

export function parseQuickExpenseMessage(text: string): {
  amount: number
  category: string
  description: string
} | null {
  const match = text.trim().match(/^(\d+(?:\.\d{1,2})?)\s+(\w+)\s+(.+)$/i)
  if (!match) return null

  const amount = Number(match[1])
  const categoryRaw = match[2]
  const description = match[3].trim()
  if (!Number.isFinite(amount) || amount <= 0 || !description) return null

  const category = TELEGRAM_EXPENSE_CATEGORIES.find(
    (c) => c.toLowerCase() === categoryRaw.toLowerCase(),
  )
  if (!category) return null

  return { amount, category, description }
}

function expenseStatusForTelegramRole(role: UserRole): 'pending' | 'approved' {
  if (role === 'engineer') return 'pending'
  if (role === 'admin') return 'approved'
  return 'pending'
}

export async function createTelegramExpense(input: {
  profileId: string
  role: UserRole
  projectId: string
  category: string
  description: string
  amount: number
  vendorName?: string | null
}): Promise<{ ok: true; expenseId: string } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const status = expenseStatusForTelegramRole(input.role)

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      project_id: input.projectId,
      milestone_id: null,
      category: input.category,
      description: input.description,
      amount: input.amount,
      vendor_name: input.vendorName ?? null,
      bill_number: null,
      expense_date: today,
      status,
      entered_by: input.profileId,
      submitted_by: input.profileId,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to save expense' }
  }

  return { ok: true, expenseId: data.id }
}

export async function attachTelegramReceipt(input: {
  projectId: string
  expenseId: string
  buffer: ArrayBuffer
  mimeType: string
  fileName: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient()

  const upload = await uploadExpenseInvoiceFile(supabase, {
    projectId: input.projectId,
    expenseId: input.expenseId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileBuffer: input.buffer,
  })

  if ('error' in upload) {
    return { ok: false, error: upload.error }
  }

  const { error } = await supabase.from('expense_invoices').insert({
    expense_id: input.expenseId,
    file_path: upload.filePath,
    file_name: input.fileName,
    file_mime_type: input.mimeType,
    processing_status: 'pending',
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export function formatExpenseSummary(payload: ExpenseSessionPayload): string {
  return [
    'Please confirm this expense:',
    '',
    `Project: ${payload.projectName ?? '—'}`,
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
