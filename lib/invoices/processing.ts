import type { SupabaseClient } from '@supabase/supabase-js'

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

/**
 * Placeholder OCR pipeline. Returns empty extraction results until OCR is implemented.
 */
export async function extractInvoiceData(
  _filePath: string,
  _mimeType: string,
): Promise<InvoiceProcessingResult> {
  return {
    vendorName: null,
    invoiceNumber: null,
    invoiceDate: null,
    invoiceTotal: null,
    items: [],
  }
}

/**
 * Runs the invoice processing pipeline for a stored expense invoice.
 * Currently a no-op stub that leaves status as pending for future OCR integration.
 */
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
    const extracted = await extractInvoiceData(
      invoice.file_path as string,
      invoice.file_mime_type as string,
    )

    // OCR not implemented yet — keep invoice pending with no extracted fields.
    if (extracted.items.length > 0) {
      const { error: itemsError } = await supabase.from('invoice_items').insert(
        extracted.items.map((item) => ({
          expense_id: invoice.expense_id,
          material_description_original: item.materialDescriptionOriginal,
          material_description_standardized: item.materialDescriptionStandardized,
          quantity: item.quantity,
          unit: item.unit,
          unit_rate: item.unitRate,
          total_amount: item.totalAmount,
        })),
      )

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      const { error: updateError } = await supabase
        .from('expense_invoices')
        .update({
          vendor_name: extracted.vendorName,
          invoice_number: extracted.invoiceNumber,
          invoice_date: extracted.invoiceDate,
          invoice_total: extracted.invoiceTotal,
          processing_status: 'completed',
        })
        .eq('id', invoiceId)

      if (updateError) {
        throw new Error(updateError.message)
      }
    } else {
      const { error: resetError } = await supabase
        .from('expense_invoices')
        .update({ processing_status: 'pending' })
        .eq('id', invoiceId)

      if (resetError) {
        throw new Error(resetError.message)
      }
    }

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
