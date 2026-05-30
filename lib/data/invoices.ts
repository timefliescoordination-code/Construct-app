import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import {
  uploadExpenseInvoiceFile,
  deleteExpenseInvoiceFile,
  createSignedExpenseInvoiceUrl,
} from '@/lib/invoices/storage'
import { scheduleExpenseInvoiceProcessing } from '@/lib/invoices/processing'
import type {
  ExpenseInvoice,
  ExpenseInvoiceWithItems,
  InvoiceItem,
  MaterialMappingReview,
} from '@/lib/types/database'

export type CreateExpenseInvoiceInput = {
  expenseId: string
  projectId: string
  fileName: string
  mimeType: string
  fileBuffer: ArrayBuffer
}

export type ReplaceExpenseInvoiceInput = CreateExpenseInvoiceInput

async function verifyExpenseInProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
  projectId: string,
) {
  const { data: expense, error } = await supabase
    .from('expenses')
    .select('id, project_id')
    .eq('id', expenseId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    return { expense: null, error: getSupabaseErrorMessage(error) }
  }

  if (!expense) {
    return { expense: null, error: 'Expense not found for this project.' }
  }

  return { expense, error: null }
}

async function clearInvoiceDerivedData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
) {
  await supabase.from('invoice_items').delete().eq('expense_id', expenseId)
  await supabase.from('material_mapping_reviews').delete().eq('expense_id', expenseId)
  await supabase.from('expenses').update({ material_rate_warning: false }).eq('id', expenseId)
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

  const { error: expenseError } = await verifyExpenseInProject(
    supabase,
    input.expenseId,
    input.projectId,
  )

  if (expenseError) {
    return { data: null, error: expenseError }
  }

  const { data: existingInvoice } = await supabase
    .from('expense_invoices')
    .select('id')
    .eq('expense_id', input.expenseId)
    .maybeSingle()

  if (existingInvoice) {
    return { data: null, error: 'This expense already has an invoice. Replace it instead.' }
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
  scheduleExpenseInvoiceProcessing(invoice.id)

  return { data: invoice, error: null }
}

export async function replaceExpenseInvoiceRecord(
  input: ReplaceExpenseInvoiceInput,
): Promise<{ data: ExpenseInvoice | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to replace invoices.' }
  }

  const { error: expenseError } = await verifyExpenseInProject(
    supabase,
    input.expenseId,
    input.projectId,
  )

  if (expenseError) {
    return { data: null, error: expenseError }
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

  const oldFilePath = existing.file_path as string
  if (oldFilePath !== upload.filePath) {
    await deleteExpenseInvoiceFile(supabase, oldFilePath)
  }

  await clearInvoiceDerivedData(supabase, input.expenseId)

  const { data, error } = await supabase
    .from('expense_invoices')
    .update({
      file_path: upload.filePath,
      file_name: input.fileName,
      file_mime_type: input.mimeType,
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

  const invoice = data as ExpenseInvoice
  scheduleExpenseInvoiceProcessing(invoice.id)

  return { data: invoice, error: null }
}

export async function deleteExpenseInvoiceRecord(input: {
  projectId: string
  expenseId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in to delete invoices.' }
  }

  const { error: expenseError } = await verifyExpenseInProject(
    supabase,
    input.expenseId,
    input.projectId,
  )

  if (expenseError) {
    return { ok: false, error: expenseError }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('expense_invoices')
    .select('id, file_path')
    .eq('expense_id', input.expenseId)
    .maybeSingle()

  if (invoiceError) {
    return { ok: false, error: getSupabaseErrorMessage(invoiceError) }
  }

  if (!invoice) {
    return { ok: false, error: 'No invoice found for this expense.' }
  }

  await deleteExpenseInvoiceFile(supabase, invoice.file_path as string)
  await clearInvoiceDerivedData(supabase, input.expenseId)

  const { error: deleteError } = await supabase
    .from('expense_invoices')
    .delete()
    .eq('id', invoice.id)

  if (deleteError) {
    return { ok: false, error: getSupabaseErrorMessage(deleteError) }
  }

  return { ok: true }
}

export async function getExpenseInvoiceViewUrl(input: {
  projectId: string
  expenseId: string
}): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { url: null, error: 'You must be signed in to view invoices.' }
  }

  const { error: expenseError } = await verifyExpenseInProject(
    supabase,
    input.expenseId,
    input.projectId,
  )

  if (expenseError) {
    return { url: null, error: expenseError }
  }

  const invoiceExpenseId = await resolveInvoiceExpenseId(supabase, input.expenseId)

  if (!invoiceExpenseId) {
    return { url: null, error: 'No invoice found for this expense.' }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('expense_invoices')
    .select('file_path')
    .eq('expense_id', invoiceExpenseId)
    .maybeSingle()

  if (invoiceError) {
    return { url: null, error: getSupabaseErrorMessage(invoiceError) }
  }

  if (!invoice) {
    return { url: null, error: 'No invoice found for this expense.' }
  }

  const signed = await createSignedExpenseInvoiceUrl(supabase, invoice.file_path as string)

  if ('error' in signed) {
    return { url: null, error: signed.error }
  }

  return { url: signed.url, error: null }
}

async function resolveInvoiceExpenseId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
): Promise<string | null> {
  const { data: direct } = await supabase
    .from('expense_invoices')
    .select('expense_id')
    .eq('expense_id', expenseId)
    .maybeSingle()

  if (direct?.expense_id) {
    return direct.expense_id as string
  }

  const { data: expense } = await supabase
    .from('expenses')
    .select('split_group_id')
    .eq('id', expenseId)
    .maybeSingle()

  const splitGroupId = expense?.split_group_id as string | null | undefined
  if (!splitGroupId) {
    return null
  }

  const { data: siblings } = await supabase
    .from('expenses')
    .select('id')
    .eq('split_group_id', splitGroupId)

  const siblingIds = (siblings ?? []).map((row) => row.id as string)
  if (siblingIds.length === 0) {
    return null
  }

  const { data: groupInvoice } = await supabase
    .from('expense_invoices')
    .select('expense_id')
    .in('expense_id', siblingIds)
    .limit(1)
    .maybeSingle()

  return (groupInvoice?.expense_id as string | undefined) ?? null
}

async function expandExpenseIdsWithSplitGroupInvoices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  invoiceExpenseIds: string[],
): Promise<string[]> {
  if (invoiceExpenseIds.length === 0) {
    return []
  }

  const { data: invoicedExpenses } = await supabase
    .from('expenses')
    .select('id, split_group_id')
    .eq('project_id', projectId)
    .in('id', invoiceExpenseIds)

  const splitGroupIds = [
    ...new Set(
      (invoicedExpenses ?? [])
        .map((row) => row.split_group_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const result = new Set(invoiceExpenseIds)

  if (splitGroupIds.length > 0) {
    const { data: groupExpenses } = await supabase
      .from('expenses')
      .select('id')
      .eq('project_id', projectId)
      .in('split_group_id', splitGroupIds)

    for (const row of groupExpenses ?? []) {
      result.add(row.id as string)
    }
  }

  return [...result]
}

export async function listExpenseIdsWithInvoicesForProject(projectId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { expenseIds: [] as string[], error: 'You must be signed in to view invoices.' }
  }

  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('id')
    .eq('project_id', projectId)

  if (expensesError) {
    return { expenseIds: [] as string[], error: getSupabaseErrorMessage(expensesError) }
  }

  const expenseIds = (expenses ?? []).map((row) => row.id as string)
  if (expenseIds.length === 0) {
    return { expenseIds: [] as string[], error: null }
  }

  const { data, error } = await supabase
    .from('expense_invoices')
    .select('expense_id')
    .in('expense_id', expenseIds)

  if (error) {
    return { expenseIds: [] as string[], error: getSupabaseErrorMessage(error) }
  }

  const directIds = (data ?? []).map((row) => row.expense_id as string)
  const expandedExpenseIds = await expandExpenseIdsWithSplitGroupInvoices(
    supabase,
    projectId,
    directIds,
  )

  return {
    expenseIds: expandedExpenseIds,
    error: null,
  }
}

export type ExpenseInvoiceDetailsPayload = {
  invoice: ExpenseInvoiceWithItems
  viewUrl: string | null
  pendingReviews: MaterialMappingReview[]
}

export async function getExpenseInvoiceDetails(input: {
  projectId: string
  expenseId: string
}): Promise<{ data: ExpenseInvoiceDetailsPayload | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view invoices.' }
  }

  const { error: expenseError } = await verifyExpenseInProject(
    supabase,
    input.expenseId,
    input.projectId,
  )

  if (expenseError) {
    return { data: null, error: expenseError }
  }

  const invoiceExpenseId = await resolveInvoiceExpenseId(supabase, input.expenseId)

  if (!invoiceExpenseId) {
    return { data: null, error: 'No invoice found for this expense.' }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('expense_invoices')
    .select('*')
    .eq('expense_id', invoiceExpenseId)
    .maybeSingle()

  if (invoiceError) {
    return { data: null, error: getSupabaseErrorMessage(invoiceError) }
  }

  if (!invoice) {
    return { data: null, error: 'No invoice found for this expense.' }
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('expense_id', invoiceExpenseId)
    .order('created_at', { ascending: true })

  if (itemsError) {
    return { data: null, error: getSupabaseErrorMessage(itemsError) }
  }

  const { data: reviews, error: reviewsError } = await supabase
    .from('material_mapping_reviews')
    .select('*')
    .eq('expense_id', input.expenseId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (reviewsError && reviewsError.code !== 'PGRST205') {
    return { data: null, error: getSupabaseErrorMessage(reviewsError) }
  }

  const signed = await createSignedExpenseInvoiceUrl(supabase, invoice.file_path as string)
  const viewUrl = 'error' in signed ? null : signed.url

  return {
    data: {
      invoice: {
        ...(invoice as ExpenseInvoice),
        items: (items ?? []) as InvoiceItem[],
      },
      viewUrl,
      pendingReviews: (reviews ?? []) as MaterialMappingReview[],
    },
    error: null,
  }
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
