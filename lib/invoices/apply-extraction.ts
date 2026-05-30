import type { SupabaseClient } from '@supabase/supabase-js'
import { isRateIncreasedWarning } from '@/lib/materials/constants'
import { recordMaterialPurchase } from '@/lib/data/materials'
import { EXPENSE_INVOICE_BUCKET } from '@/lib/invoices/constants'
import { extractInvoiceDataFromBuffer } from '@/lib/invoices/ocr/extract'
import {
  buildMaterialLookup,
  normalizeMaterialDescription,
  type MaterialNormalizationResult,
} from '@/lib/invoices/normalize-material'
import type { InvoiceProcessingResult } from '@/lib/invoices/processing'

type ExpenseContext = {
  id: string
  project_id: string
  vendor_name: string | null
  bill_number: string | null
  expense_date: string
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

async function applyMaterialPurchaseUpdates(
  supabase: SupabaseClient,
  materialId: string,
  unitRate: number,
  expense: ExpenseContext,
  vendorName: string | null,
  purchaseDate: string | null,
): Promise<boolean> {
  const { data: before } = await supabase
    .from('material_master')
    .select('average_rate, latest_rate')
    .eq('id', materialId)
    .maybeSingle()

  const result = await recordMaterialPurchase({
    materialId,
    purchaseRate: unitRate,
    projectId: expense.project_id,
    vendorName: vendorName ?? expense.vendor_name,
    purchaseDate: purchaseDate ?? expense.expense_date,
    expenseId: expense.id,
  })

  if (result.error) {
    throw new Error(result.error)
  }

  const { data: after } = await supabase
    .from('material_master')
    .select('average_rate, latest_rate')
    .eq('id', materialId)
    .maybeSingle()

  const averageRate = Number(after?.average_rate ?? before?.average_rate ?? 0)
  const latestRate = Number(after?.latest_rate ?? before?.latest_rate ?? 0)

  return isRateIncreasedWarning(latestRate, averageRate)
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
    .select('id, project_id, vendor_name, bill_number, expense_date')
    .eq('id', invoice.expense_id)
    .maybeSingle()

  if (expenseError || !expense) {
    throw new Error(expenseError?.message ?? 'Expense not found.')
  }

  const expenseContext = expense as ExpenseContext
  const lookup = await buildMaterialLookup(supabase)
  let hasRateWarning = false

  await supabase.from('invoice_items').delete().eq('expense_id', expenseContext.id)
  await supabase
    .from('material_mapping_reviews')
    .delete()
    .eq('expense_id', expenseContext.id)
    .eq('status', 'pending')

  for (const item of extracted.items) {
    const normalized: MaterialNormalizationResult = normalizeMaterialDescription(
      item.materialDescriptionOriginal,
      lookup,
    )

    const { data: insertedItem, error: itemError } = await supabase
      .from('invoice_items')
      .insert({
        expense_id: expenseContext.id,
        material_id: normalized.matched ? normalized.materialId : null,
        material_description_original: item.materialDescriptionOriginal,
        material_description_standardized: normalized.matched
          ? normalized.standardizedName
          : null,
        quantity: item.quantity,
        unit: item.unit,
        unit_rate: item.unitRate,
        total_amount: item.totalAmount,
      })
      .select('id')
      .single()

    if (itemError || !insertedItem) {
      throw new Error(itemError?.message ?? 'Failed to save invoice line item.')
    }

    if (normalized.matched && item.unitRate != null && item.unitRate > 0) {
      const warning = await applyMaterialPurchaseUpdates(
        supabase,
        normalized.materialId,
        item.unitRate,
        expenseContext,
        extracted.vendorName,
        extracted.invoiceDate,
      )
      if (warning) hasRateWarning = true
      continue
    }

    if (!normalized.matched) {
      const { error: reviewError } = await supabase.from('material_mapping_reviews').insert({
        alias_name: item.materialDescriptionOriginal,
        expense_id: expenseContext.id,
        invoice_item_id: insertedItem.id,
        status: 'pending',
      })

      if (reviewError) {
        throw new Error(reviewError.message)
      }
    }
  }

  const expenseUpdates: Record<string, string | boolean | null> = {
    material_rate_warning: hasRateWarning,
  }

  if (extracted.vendorName && !expenseContext.vendor_name) {
    expenseUpdates.vendor_name = extracted.vendorName
  }

  if (extracted.invoiceNumber && !expenseContext.bill_number) {
    expenseUpdates.bill_number = extracted.invoiceNumber
  }

  const { error: expenseUpdateError } = await supabase
    .from('expenses')
    .update(expenseUpdates)
    .eq('id', expenseContext.id)

  if (expenseUpdateError) {
    throw new Error(expenseUpdateError.message)
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
