import {
  INVOICE_UPLOAD_CONFIG,
  type InvoiceAllowedMimeType,
} from '@/lib/invoices/constants'
import type { FileValidationResult } from '@/lib/file-upload'
import { formatFileSize } from '@/lib/file-upload'

function extensionFromName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) return ''
  return fileName.slice(dot).toLowerCase()
}

function isAllowedExtension(fileName: string): boolean {
  const ext = extensionFromName(fileName)
  return INVOICE_UPLOAD_CONFIG.allowedExtensions.includes(
    ext as (typeof INVOICE_UPLOAD_CONFIG.allowedExtensions)[number],
  )
}

export function validateInvoiceFile(file: File): FileValidationResult {
  if (file.size > INVOICE_UPLOAD_CONFIG.maxFileSizeBytes) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the maximum allowed size of ${INVOICE_UPLOAD_CONFIG.maxFileSizeMB}MB.`,
    }
  }

  const mimeAllowed = INVOICE_UPLOAD_CONFIG.allowedMimeTypes.includes(
    file.type as InvoiceAllowedMimeType,
  )
  const extensionAllowed = isAllowedExtension(file.name)

  if (!mimeAllowed && !extensionAllowed) {
    return {
      valid: false,
      error: 'File type not supported. Please upload PDF, JPG, JPEG, or PNG files only.',
    }
  }

  return { valid: true }
}

export function sanitizeInvoiceFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'invoice'
  const cleaned = base.replace(/[^\w.\-() ]+/g, '_').trim()
  return cleaned || 'invoice'
}

export function buildExpenseInvoiceStoragePath(
  projectId: string,
  expenseId: string,
  fileName: string,
): string {
  const safeName = sanitizeInvoiceFileName(fileName)
  return `${projectId}/${expenseId}/${Date.now()}-${safeName}`
}
