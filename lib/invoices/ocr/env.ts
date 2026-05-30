function readOpenAiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || process.env.AI_GATEWAY_API_KEY?.trim()
}

export function isInvoiceOcrConfigured(): boolean {
  const key = readOpenAiKey()
  return Boolean(key && !key.startsWith('sk-placeholder'))
}

export function getOpenAiApiKey(): string {
  const key = readOpenAiKey()
  if (!key) {
    throw new Error(
      'Invoice OCR is not configured. Set OPENAI_API_KEY in environment variables.',
    )
  }
  return key
}

export function getInvoiceOcrModel(): string {
  return process.env.INVOICE_OCR_MODEL?.trim() || 'gpt-4o-mini'
}
