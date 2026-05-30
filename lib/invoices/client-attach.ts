import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import {
  deleteExpenseInvoiceFile,
  uploadExpenseInvoiceBlob,
} from '@/lib/invoices/storage'
import { validateInvoiceFile, resolveInvoiceMimeType } from '@/lib/invoices/validate'
import type { ExpenseInvoice } from '@/lib/types/database'

type AttachInput = {
  projectId: string
  expenseId: string
  file: File
}

async function verifyExpenseInProject(
  supabase: SupabaseClient,
  expenseId: string,
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .select('id')
    .eq('id', expenseId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  if (!expense) {
    return { ok: false, error: 'Expense not found for this project.' }
  }

  return { ok: true }
}

export async function attachExpenseInvoiceFromBrowser(
  supabase: SupabaseClient,
  input: AttachInput,
): Promise<{ data: ExpenseInvoice | null; error: string | null }> {
  const validation = validateInvoiceFile(input.file)
  if (!validation.valid) {
    return { data: null, error: validation.error ?? 'Invalid invoice file.' }
  }

  const verified = await verifyExpenseInProject(supabase, input.expenseId, input.projectId)
  if (!verified.ok) {
    return { data: null, error: verified.error }
  }

  const { data: existingInvoice } = await supabase
    .from('expense_invoices')
    .select('id')
    .eq('expense_id', input.expenseId)
    .maybeSingle()

  if (existingInvoice) {
    return { data: null, error: 'This expense already has an invoice. Replace it instead.' }
  }

  const mimeType = resolveInvoiceMimeType(input.file)
  const upload = await uploadExpenseInvoiceBlob(supabase, {
    projectId: input.projectId,
    expenseId: input.expenseId,
    fileName: input.file.name,
    mimeType,
    file: input.file,
  })

  if ('error' in upload) {
    return { data: null, error: upload.error }
  }

  const { data, error } = await supabase
    .from('expense_invoices')
    .insert({
      expense_id: input.expenseId,
      file_path: upload.filePath,
      file_name: input.file.name,
      file_mime_type: mimeType,
      processing_status: 'pending',
    })
    .select('*')
    .single()

  if (error) {
    await deleteExpenseInvoiceFile(supabase, upload.filePath)
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: data as ExpenseInvoice, error: null }
}

export async function replaceExpenseInvoiceFromBrowser(
  supabase: SupabaseClient,
  input: AttachInput,
): Promise<{ data: ExpenseInvoice | null; error: string | null }> {
  const validation = validateInvoiceFile(input.file)
  if (!validation.valid) {
    return { data: null, error: validation.error ?? 'Invalid invoice file.' }
  }

  const verified = await verifyExpenseInProject(supabase, input.expenseId, input.projectId)
  if (!verified.ok) {
    return { data: null, error: verified.error }
  }

  const { data: existing, error: existingError } = await supabase
    .from('expense_invoices')
    .select('*')
    .eq('expense_id', input.expenseId)
    .maybeSingle()

  if (existingError) {
    return { data: null, error: getSupabaseErrorMessage(existingError) }
  }

  if (!existing) {
    return { data: null, error: 'No invoice found for this expense.' }
  }

  const mimeType = resolveInvoiceMimeType(input.file)
  const upload = await uploadExpenseInvoiceBlob(supabase, {
    projectId: input.projectId,
    expenseId: input.expenseId,
    fileName: input.file.name,
    mimeType,
    file: input.file,
  })

  if ('error' in upload) {
    return { data: null, error: upload.error }
  }

  const oldFilePath = existing.file_path as string
  if (oldFilePath !== upload.filePath) {
    await deleteExpenseInvoiceFile(supabase, oldFilePath)
  }

  await supabase.from('invoice_items').delete().eq('expense_id', input.expenseId)
  await supabase.from('material_mapping_reviews').delete().eq('expense_id', input.expenseId)
  await supabase
    .from('expenses')
    .update({ material_rate_warning: false })
    .eq('id', input.expenseId)

  const { data, error } = await supabase
    .from('expense_invoices')
    .update({
      file_path: upload.filePath,
      file_name: input.file.name,
      file_mime_type: mimeType,
      vendor_name: null,
      invoice_number: null,
      invoice_date: null,
      invoice_total: null,
      processing_status: 'pending',
    })
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error) {
    await deleteExpenseInvoiceFile(supabase, upload.filePath)
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: data as ExpenseInvoice, error: null }
}
