import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPENSE_INVOICE_BUCKET } from '@/lib/invoices/constants'
import { buildExpenseInvoiceStoragePath } from '@/lib/invoices/validate'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export type UploadExpenseInvoiceFileInput = {
  projectId: string
  expenseId: string
  fileName: string
  mimeType: string
  fileBuffer: ArrayBuffer
}

export async function uploadExpenseInvoiceFile(
  supabase: SupabaseClient,
  input: UploadExpenseInvoiceFileInput,
): Promise<{ filePath: string } | { error: string }> {
  const filePath = buildExpenseInvoiceStoragePath(
    input.projectId,
    input.expenseId,
    input.fileName,
  )

  const { error } = await supabase.storage
    .from(EXPENSE_INVOICE_BUCKET)
    .upload(filePath, input.fileBuffer, {
      contentType: input.mimeType,
      upsert: false,
    })

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { filePath }
}

export async function deleteExpenseInvoiceFile(
  supabase: SupabaseClient,
  filePath: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.storage.from(EXPENSE_INVOICE_BUCKET).remove([filePath])

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { ok: true }
}

export async function createSignedExpenseInvoiceUrl(
  supabase: SupabaseClient,
  filePath: string,
  expiresInSeconds = 3600,
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(EXPENSE_INVOICE_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    return { error: error ? getSupabaseErrorMessage(error) : 'Failed to create download URL.' }
  }

  return { url: data.signedUrl }
}
