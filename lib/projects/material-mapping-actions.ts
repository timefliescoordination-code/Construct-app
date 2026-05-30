'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import {
  listMaterialsForMapping,
  mapMaterialReviewToMaster,
} from '@/lib/data/material-mapping-reviews'
import type { TabActionResult } from '@/lib/projects/tab-actions'
import type { UserRole } from '@/lib/types/database'

async function getSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, error: 'You must be signed in.' }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: getSupabaseErrorMessage(error) }
  }

  const role = (profile?.role ?? null) as UserRole | null
  if (!role) {
    return { ok: false as const, error: 'Your profile role is not set.' }
  }

  return { ok: true as const, supabase, userId: user.id, role }
}

function canMapMaterials(role: UserRole) {
  return role === 'admin' || role === 'pm'
}

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/admin')
  revalidatePath('/admin/material-intelligence')
  revalidatePath('/pm')
}

export async function listMaterialsForMappingAction(): Promise<
  TabActionResult<Array<{ id: string; materialName: string }>>
> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canMapMaterials(session.role)) {
    return { ok: false, error: 'Only admins and project managers can map materials.' }
  }

  const { data, error } = await listMaterialsForMapping()
  if (error || !data) {
    return { ok: false, error: error ?? 'Failed to load materials.' }
  }

  return { ok: true, data }
}

export async function mapMaterialReviewAction(input: {
  projectId: string
  reviewId: string
  materialId: string
}): Promise<TabActionResult<true>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canMapMaterials(session.role)) {
    return { ok: false, error: 'Only admins and project managers can map materials.' }
  }

  const { data, error } = await mapMaterialReviewToMaster({
    reviewId: input.reviewId,
    materialId: input.materialId,
    mappedBy: session.userId,
  })

  if (error || !data) {
    return { ok: false, error: error ?? 'Failed to save material mapping.' }
  }

  revalidateProject(input.projectId)
  return { ok: true, data: true }
}
