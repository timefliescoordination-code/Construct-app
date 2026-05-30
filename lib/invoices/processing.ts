import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyInvoiceExtraction,
  extractAndPrepareInvoice,
} from '@/lib/invoices/apply-extraction'
import { isInvoiceOcrConfigured } from '@/lib/invoices/ocr/env'

export type InvoiceProcessingResult = {
  vendorName: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  invoiceTotal: number | null
  items: Array<{
    materialDescriptionOriginal: string
    materialDescriptionStandardized: string | null
    quantity: number | null
    unit: string | null
    unitRate: number | null
    totalAmount: number
  }>
}

export async function processExpenseInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: processingError } = await supabase
    .from('expense_invoices')
    .update({ processing_status: 'processing' })
    .eq('id', invoiceId)

  if (processingError) {
    return { ok: false, error: processingError.message }
  }

  const { data: invoice, error: fetchError } = await supabase
    .from('expense_invoices')
    .select('id, expense_id, file_path, file_mime_type')
    .eq('id', invoiceId)
    .maybeSingle()

  if (fetchError || !invoice) {
    await supabase
      .from('expense_invoices')
      .update({ processing_status: 'failed' })
      .eq('id', invoiceId)
    return { ok: false, error: fetchError?.message ?? 'Invoice not found.' }
  }

  try {
    if (!isInvoiceOcrConfigured()) {
      await supabase
        .from('expense_invoices')
        .update({ processing_status: 'pending' })
        .eq('id', invoiceId)
      return { ok: true }
    }

    const extracted = await extractAndPrepareInvoice(
      supabase,
      invoice.file_path as string,
      invoice.file_mime_type as string,
    )

    if (extracted.items.length === 0 && !extracted.vendorName && !extracted.invoiceNumber) {
      await supabase
        .from('expense_invoices')
        .update({ processing_status: 'failed' })
        .eq('id', invoiceId)
      return { ok: false, error: 'No invoice data could be extracted.' }
    }

    await applyInvoiceExtraction(supabase, invoiceId, extracted)
    return { ok: true }
  } catch (error) {
    await supabase
      .from('expense_invoices')
      .update({ processing_status: 'failed' })
      .eq('id', invoiceId)

    const message = error instanceof Error ? error.message : 'Invoice processing failed.'
    return { ok: false, error: message }
  }
}

export async function enqueueExpenseInvoiceProcessing(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  await processExpenseInvoice(supabase, invoiceId)
}
