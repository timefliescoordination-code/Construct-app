'use server'

import { revalidatePath } from 'next/cache'
import { createExpenseInvoiceRecord } from '@/lib/data/invoices'
import { validateInvoiceFile } from '@/lib/invoices/validate'
import type { TabActionResult } from '@/lib/projects/tab-actions'
import type { ExpenseInvoice } from '@/lib/types/database'

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/admin')
  revalidatePath('/pm')
}

export async function attachExpenseInvoiceAction(
  formData: FormData,
): Promise<TabActionResult<ExpenseInvoice>> {
  const projectId = formData.get('projectId')
  const expenseId = formData.get('expenseId')
  const file = formData.get('file')

  if (typeof projectId !== 'string' || !projectId) {
    return { ok: false, error: 'Project ID is required.' }
  }

  if (typeof expenseId !== 'string' || !expenseId) {
    return { ok: false, error: 'Expense ID is required.' }
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Invoice file is required.' }
  }

  const validation = validateInvoiceFile(file)
  if (!validation.valid) {
    return { ok: false, error: validation.error ?? 'Invalid invoice file.' }
  }

  const mimeType = file.type || 'application/octet-stream'
  const fileBuffer = await file.arrayBuffer()

  const { data, error } = await createExpenseInvoiceRecord({
    expenseId,
    projectId,
    fileName: file.name,
    mimeType,
    fileBuffer,
  })

  if (error || !data) {
    return { ok: false, error: error ?? 'Failed to store invoice.' }
  }

  revalidateProject(projectId)
  return { ok: true, data }
}
