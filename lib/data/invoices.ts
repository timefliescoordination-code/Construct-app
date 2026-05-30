import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { uploadExpenseInvoiceFile, deleteExpenseInvoiceFile } from '@/lib/invoices/storage'
import { enqueueExpenseInvoiceProcessing } from '@/lib/invoices/processing'
import type {
  ExpenseInvoice,
  ExpenseInvoiceWithItems,
  InvoiceItem,
} from '@/lib/types/database'

export type CreateExpenseInvoiceInput = {
  expenseId: string
  projectId: string
  fileName: string
  mimeType: string
  fileBuffer: ArrayBuffer
}

export async function createExpenseInvoiceRecord(
  input: CreateExpenseInvoiceInput,
): Promise<{ data: ExpenseInvoice | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to upload invoices.' }
  }

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .select('id, project_id')
    .eq('id', input.expenseId)
    .eq('project_id', input.projectId)
    .maybeSingle()

  if (expenseError) {
    return { data: null, error: getSupabaseErrorMessage(expenseError) }
  }

  if (!expense) {
    return { data: null, error: 'Expense not found for this project.' }
  }

  const upload = await uploadExpenseInvoiceFile(supabase, {
    projectId: input.projectId,
    expenseId: input.expenseId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileBuffer: input.fileBuffer,
  })

  if ('error' in upload) {
    return { data: null, error: upload.error }
  }

  const { data, error } = await supabase
    .from('expense_invoices')
    .insert({
      expense_id: input.expenseId,
      file_path: upload.filePath,
      file_name: input.fileName,
      file_mime_type: input.mimeType,
      processing_status: 'pending',
    })
    .select('*')
    .single()

  if (error) {
    await deleteExpenseInvoiceFile(supabase, upload.filePath)
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  const invoice = data as ExpenseInvoice
  await enqueueExpenseInvoiceProcessing(supabase, invoice.id)

  return { data: invoice, error: null }
}

export async function getExpenseInvoiceByExpenseId(expenseId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view invoices.' }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('expense_invoices')
    .select('*')
    .eq('expense_id', expenseId)
    .maybeSingle()

  if (invoiceError) {
    return { data: null, error: getSupabaseErrorMessage(invoiceError) }
  }

  if (!invoice) {
    return { data: null, error: null }
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: true })

  if (itemsError) {
    return { data: null, error: getSupabaseErrorMessage(itemsError) }
  }

  const payload: ExpenseInvoiceWithItems = {
    ...(invoice as ExpenseInvoice),
    items: (items ?? []) as InvoiceItem[],
  }

  return { data: payload, error: null }
}

export async function listInvoiceItemsByExpenseId(expenseId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view invoice items.' }
  }

  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: true })

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: (data ?? []) as InvoiceItem[], error: null }
}
