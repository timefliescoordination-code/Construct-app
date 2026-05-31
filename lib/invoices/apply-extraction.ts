import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPENSE_INVOICE_BUCKET } from '@/lib/invoices/constants'
import { extractInvoiceDataFromBuffer } from '@/lib/invoices/ocr/extract'
import type { InvoiceProcessingResult } from '@/lib/invoices/processing'

type ExpenseContext = {
  id: string
  vendor_name: string | null
  bill_number: string | null
}

async function downloadInvoiceFile(
  supabase: SupabaseClient,
  filePath: string,
): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(EXPENSE_INVOICE_BUCKET).download(filePath)

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to download invoice file.')
  }

  return data.arrayBuffer()
}

export async function applyInvoiceExtraction(
  supabase: SupabaseClient,
  invoiceId: string,
  extracted: InvoiceProcessingResult,
): Promise<void> {
  const { data: invoice, error: invoiceError } = await supabase
    .from('expense_invoices')
    .select('id, expense_id, file_path, file_mime_type')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? 'Invoice not found.')
  }

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .select('id, vendor_name, bill_number')
    .eq('id', invoice.expense_id)
    .maybeSingle()

  if (expenseError || !expense) {
    throw new Error(expenseError?.message ?? 'Expense not found.')
  }

  const expenseContext = expense as ExpenseContext

  await supabase.from('invoice_items').delete().eq('expense_id', expenseContext.id)

  for (const item of extracted.items) {
    const { error: itemError } = await supabase.from('invoice_items').insert({
      expense_id: expenseContext.id,
      material_description_original: item.materialDescriptionOriginal,
      material_description_standardized: null,
      quantity: item.quantity,
      unit: item.unit,
      unit_rate: item.unitRate,
      total_amount: item.totalAmount,
    })

    if (itemError) {
      throw new Error(itemError.message ?? 'Failed to save invoice line item.')
    }
  }

  const expenseUpdates: Record<string, string | null> = {}

  if (extracted.vendorName && !expenseContext.vendor_name) {
    expenseUpdates.vendor_name = extracted.vendorName
  }

  if (extracted.invoiceNumber && !expenseContext.bill_number) {
    expenseUpdates.bill_number = extracted.invoiceNumber
  }

  if (Object.keys(expenseUpdates).length > 0) {
    const { error: expenseUpdateError } = await supabase
      .from('expenses')
      .update(expenseUpdates)
      .eq('id', expenseContext.id)

    if (expenseUpdateError) {
      throw new Error(expenseUpdateError.message)
    }
  }

  const { error: invoiceUpdateError } = await supabase
    .from('expense_invoices')
    .update({
      vendor_name: extracted.vendorName,
      invoice_number: extracted.invoiceNumber,
      invoice_date: extracted.invoiceDate,
      invoice_total: extracted.invoiceTotal,
      processing_status: 'completed',
    })
    .eq('id', invoiceId)

  if (invoiceUpdateError) {
    throw new Error(invoiceUpdateError.message)
  }
}

export async function extractAndPrepareInvoice(
  supabase: SupabaseClient,
  filePath: string,
  mimeType: string,
): Promise<InvoiceProcessingResult> {
  const fileBuffer = await downloadInvoiceFile(supabase, filePath)
  return extractInvoiceDataFromBuffer(fileBuffer, mimeType)
}
