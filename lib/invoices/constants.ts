export const EXPENSE_INVOICE_BUCKET = 'expense-invoices'

export const INVOICE_UPLOAD_CONFIG = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFileSizeMB: 10,
  allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'] as const,
  allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'] as const,
}

export type InvoiceAllowedMimeType = (typeof INVOICE_UPLOAD_CONFIG.allowedMimeTypes)[number]
