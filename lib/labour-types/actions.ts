'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminSession } from '@/lib/auth/require-admin'
import {
  createCompanyLabourType,
  deleteCompanyLabourType,
  ensureCompanyLabourCatalog,
  listGlobalLabourTypes,
  updateCompanyLabourType,
} from '@/lib/data/labour-types'
import type { LabourType } from '@/lib/types/database'

export type LabourTypeActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function revalidateLabourCatalog() {
  revalidatePath('/admin/settings/labours')
  revalidatePath('/projects')
  revalidatePath('/api/labour-types')
}

export async function getCompanyLabourTypesAction(): Promise<
  LabourTypeActionResult<LabourType[]>
> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const ensured = await ensureCompanyLabourCatalog(session.supabase)
  if (!ensured.ok) return ensured

  const listed = await listGlobalLabourTypes(session.supabase)
  if (!listed.ok) return listed
  return { ok: true, data: listed.data }
}

export async function createCompanyLabourTypeAction(input: {
  name: string
  shortLabel: string
  defaultWage: number
}): Promise<LabourTypeActionResult<{ id: string }>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const result = await createCompanyLabourType(session.supabase, input)
  if (!result.ok) return result
  revalidateLabourCatalog()
  return result
}

export async function updateCompanyLabourTypeAction(input: {
  labourTypeId: string
  name: string
  shortLabel: string
  defaultWage: number
}): Promise<LabourTypeActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const result = await updateCompanyLabourType(session.supabase, input)
  if (!result.ok) return result
  revalidateLabourCatalog()
  return result
}

export async function deleteCompanyLabourTypeAction(input: {
  labourTypeId: string
}): Promise<LabourTypeActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const result = await deleteCompanyLabourType(session.supabase, input.labourTypeId)
  if (!result.ok) return result
  revalidateLabourCatalog()
  return result
}
