import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getInvoiceOcrModel, getOpenAiApiKey, isInvoiceOcrConfigured } from '@/lib/invoices/ocr/env'
import type { InvoiceProcessingResult } from '@/lib/invoices/processing'

const invoiceLineItemSchema = z.object({
  description: z.string().describe('Material or product description from the line item'),
  quantity: z.number().nullable().describe('Quantity purchased'),
  unit: z.string().nullable().describe('Unit of measure such as Nos, Bags, kg'),
  unitRate: z.number().nullable().describe('Rate per unit'),
  amount: z.number().describe('Line total amount'),
})

const invoiceExtractionSchema = z.object({
  vendorName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable().describe('ISO date YYYY-MM-DD when possible'),
  invoiceTotal: z.number().nullable(),
  lineItems: z.array(invoiceLineItemSchema),
})

function buildFileContent(fileBuffer: ArrayBuffer, mimeType: string) {
  const bytes = new Uint8Array(fileBuffer)

  if (mimeType.startsWith('image/')) {
    return {
      type: 'image' as const,
      image: bytes,
      mediaType: mimeType,
    }
  }

  return {
    type: 'file' as const,
    data: bytes,
    mediaType: mimeType,
  }
}

function normalizeIsoDate(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export async function extractInvoiceDataFromBuffer(
  fileBuffer: ArrayBuffer,
  mimeType: string,
): Promise<InvoiceProcessingResult> {
  if (!isInvoiceOcrConfigured()) {
    throw new Error('Invoice OCR is not configured. Set OPENAI_API_KEY.')
  }

  getOpenAiApiKey()

  const { object } = await generateObject({
    model: openai(getInvoiceOcrModel()),
    schema: invoiceExtractionSchema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract structured invoice data from this document.',
              'Return vendor name, invoice number, invoice date, invoice total, and all material line items.',
              'For each line item include description, quantity, unit, unit rate, and line amount.',
              'Use null when a field is not visible.',
              'Ignore taxes, discounts summary rows, and payment terms unless they are line items.',
            ].join(' '),
          },
          buildFileContent(fileBuffer, mimeType),
        ],
      },
    ],
  })

  return {
    vendorName: object.vendorName?.trim() || null,
    invoiceNumber: object.invoiceNumber?.trim() || null,
    invoiceDate: normalizeIsoDate(object.invoiceDate),
    invoiceTotal: object.invoiceTotal,
    items: object.lineItems
      .filter((item) => item.description.trim().length > 0)
      .map((item) => ({
        materialDescriptionOriginal: item.description.trim(),
        materialDescriptionStandardized: null,
        quantity: item.quantity,
        unit: item.unit?.trim() || null,
        unitRate: item.unitRate,
        totalAmount: item.amount,
      })),
  }
}
