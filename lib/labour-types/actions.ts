'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminSession } from '@/lib/auth/require-admin'
import {
  createCompanyLabourTeam,
  createCompanyLabourType,
  deleteCompanyLabourTeam,
  deleteCompanyLabourType,
  ensureLabourCatalogSeeded,
  updateCompanyLabourTeam,
  updateCompanyLabourType,
  type LabourCatalogPayload,
} from '@/lib/data/labour-types'

export type LabourTypeActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function revalidateLabourCatalog() {
  revalidatePath('/admin/settings/labours')
  revalidatePath('/projects')
  revalidatePath('/api/labour-types')
}

export async function getCompanyLabourCatalogAction(): Promise<
  LabourTypeActionResult<LabourCatalogPayload>
> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const seeded = await ensureLabourCatalogSeeded(session.supabase)
  if (!seeded.ok) return seeded
  return { ok: true, data: seeded.data }
}

export async function createCompanyLabourTeamAction(input: {
  name: string
}): Promise<LabourTypeActionResult<{ id: string }>> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const result = await createCompanyLabourTeam(session.supabase, input.name)
  if (!result.ok) return result
  revalidateLabourCatalog()
  return result
}

export async function updateCompanyLabourTeamAction(input: {
  labourTeamId: string
  name: string
}): Promise<LabourTypeActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const result = await updateCompanyLabourTeam(session.supabase, input)
  if (!result.ok) return result
  revalidateLabourCatalog()
  return result
}

export async function deleteCompanyLabourTeamAction(input: {
  labourTeamId: string
}): Promise<LabourTypeActionResult> {
  const session = await requireAdminSession()
  if (!session.ok) return session

  const result = await deleteCompanyLabourTeam(session.supabase, input.labourTeamId)
  if (!result.ok) return result
  revalidateLabourCatalog()
  return result
}

export async function createCompanyLabourTypeAction(input: {
  labourTeamId: string
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
