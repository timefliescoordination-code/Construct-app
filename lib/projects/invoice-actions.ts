'use server'

import { revalidatePath } from 'next/cache'
import {
  createExpenseInvoiceRecord,
  deleteExpenseInvoiceRecord,
  getExpenseInvoiceViewUrl,
  replaceExpenseInvoiceRecord,
} from '@/lib/data/invoices'
import { validateInvoiceFile } from '@/lib/invoices/validate'
import type { TabActionResult } from '@/lib/projects/tab-actions'
import type { ExpenseInvoice } from '@/lib/types/database'

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/admin')
  revalidatePath('/pm')
}

async function parseInvoiceUpload(formData: FormData) {
  const projectId = formData.get('projectId')
  const expenseId = formData.get('expenseId')
  const file = formData.get('file')

  if (typeof projectId !== 'string' || !projectId) {
    return { ok: false as const, error: 'Project ID is required.' }
  }

  if (typeof expenseId !== 'string' || !expenseId) {
    return { ok: false as const, error: 'Expense ID is required.' }
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: 'Invoice file is required.' }
  }

  const validation = validateInvoiceFile(file)
  if (!validation.valid) {
    return { ok: false as const, error: validation.error ?? 'Invalid invoice file.' }
  }

  const mimeType = file.type || 'application/octet-stream'
  const fileBuffer = await file.arrayBuffer()

  return {
    ok: true as const,
    projectId,
    expenseId,
    fileName: file.name,
    mimeType,
    fileBuffer,
  }
}

export async function attachExpenseInvoiceAction(
  formData: FormData,
): Promise<TabActionResult<ExpenseInvoice>> {
  const parsed = await parseInvoiceUpload(formData)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }

  const { data, error } = await createExpenseInvoiceRecord({
    expenseId: parsed.expenseId,
    projectId: parsed.projectId,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    fileBuffer: parsed.fileBuffer,
  })

  if (error || !data) {
    return { ok: false, error: error ?? 'Failed to store invoice.' }
  }

  revalidateProject(parsed.projectId)
  return { ok: true, data }
}

export async function replaceExpenseInvoiceAction(
  formData: FormData,
): Promise<TabActionResult<ExpenseInvoice>> {
  const parsed = await parseInvoiceUpload(formData)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }

  const { data, error } = await replaceExpenseInvoiceRecord({
    expenseId: parsed.expenseId,
    projectId: parsed.projectId,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    fileBuffer: parsed.fileBuffer,
  })

  if (error || !data) {
    return { ok: false, error: error ?? 'Failed to replace invoice.' }
  }

  revalidateProject(parsed.projectId)
  return { ok: true, data }
}

export async function deleteExpenseInvoiceAction(input: {
  projectId: string
  expenseId: string
}): Promise<TabActionResult> {
  if (!input.projectId) {
    return { ok: false, error: 'Project ID is required.' }
  }

  if (!input.expenseId) {
    return { ok: false, error: 'Expense ID is required.' }
  }

  const result = await deleteExpenseInvoiceRecord(input)

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  revalidateProject(input.projectId)
  return { ok: true }
}

export async function getExpenseInvoiceViewUrlAction(input: {
  projectId: string
  expenseId: string
}): Promise<TabActionResult<{ url: string }>> {
  if (!input.projectId) {
    return { ok: false, error: 'Project ID is required.' }
  }

  if (!input.expenseId) {
    return { ok: false, error: 'Expense ID is required.' }
  }

  const { url, error } = await getExpenseInvoiceViewUrl(input)

  if (error || !url) {
    return { ok: false, error: error ?? 'Failed to load invoice file.' }
  }

  return { ok: true, data: { url } }
}
