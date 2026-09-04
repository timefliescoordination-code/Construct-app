'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { notifySitePhotosBatch } from '@/lib/notifications'
import { canUserUploadSitePhotosToProject } from '@/lib/site-photos/access'
import { getCompanyWatermarkDetails } from '@/lib/site-photos/company-watermark'
import { compressAndWatermarkSitePhoto } from '@/lib/site-photos/process'
import { deleteSitePhotosFromStorage, uploadSitePhotoFile } from '@/lib/site-photos/storage'
import type { TabActionResult } from '@/lib/projects/tab-actions'
import { formatStageLabel } from '@/lib/site-photos/stage-label'
import { resolveSitePhotoMimeType, validateSitePhotoFile } from '@/lib/site-photos/validate'
import { SITE_PHOTO_UPLOAD_CONFIG } from '@/lib/site-photos/constants'
import { getLatestProjectStageFromExpenses } from '@/lib/site-photos/stage'
import type { ProjectSitePhoto, UserRole } from '@/lib/types/database'

function revalidatePhotoPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/customer')
}

async function requireSitePhotoManager(
  projectId: string,
): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role as UserRole | undefined
  if (!role) {
    return { ok: false, error: 'Your account role could not be determined.' }
  }

  const canManage = await canUserUploadSitePhotosToProject(supabase, user.id, role, projectId)
  if (!canManage) {
    return {
      ok: false,
      error: 'You do not have permission to manage site photos for this project.',
    }
  }

  return { ok: true, supabase }
}

function uniquePhotoIds(photoIds: string[]): string[] {
  return [...new Set(photoIds.map((id) => id.trim()).filter(Boolean))]
}

export async function uploadSitePhotosAction(
  formData: FormData,
): Promise<TabActionResult<{ uploadBatchId: string; count: number }>> {
  const projectId = formData.get('projectId')
  if (typeof projectId !== 'string' || !projectId) {
    return { ok: false, error: 'Project ID is required.' }
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) {
    return { ok: false, error: 'Select at least one photo to upload.' }
  }
  if (files.length > SITE_PHOTO_UPLOAD_CONFIG.maxFilesPerBatch) {
    return {
      ok: false,
      error: `Upload up to ${SITE_PHOTO_UPLOAD_CONFIG.maxFilesPerBatch} photos per batch.`,
    }
  }

  for (const file of files) {
    const validation = validateSitePhotoFile(file)
    if (!validation.valid) {
      return { ok: false, error: validation.error ?? 'Invalid photo file.' }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role as UserRole | undefined
  if (!role) {
    return { ok: false, error: 'Your account role could not be determined.' }
  }

  const canUpload = await canUserUploadSitePhotosToProject(
    supabase,
    user.id,
    role,
    projectId,
  )
  if (!canUpload) {
    return { ok: false, error: 'You do not have permission to upload site photos for this project.' }
  }

  const { data: companyDetails, error: companyError } = await getCompanyWatermarkDetails(supabase)
  if (!companyDetails) {
    return {
      ok: false,
      error:
        companyError ??
        'Company name and phone are required on the company admin profile before site photos can be uploaded.',
    }
  }

  const uploadBatchId = crypto.randomUUID()
  const uploadedAt = new Date()
  const latestStage = await getLatestProjectStageFromExpenses(supabase, projectId)
  let count = 0

  for (const file of files) {
    const photoId = crypto.randomUUID()
    const sourceMimeType = resolveSitePhotoMimeType(file)
    const inputBuffer = Buffer.from(await file.arrayBuffer())

    const processed = await compressAndWatermarkSitePhoto(
      inputBuffer,
      companyDetails.watermarkText,
      sourceMimeType,
    )

    const upload = await uploadSitePhotoFile(supabase, {
      projectId,
      uploadBatchId,
      photoId,
      mimeType: processed.contentType,
      fileBuffer: processed.buffer,
    })

    if ('error' in upload) {
      return {
        ok: false,
        error: `${upload.error} (${count} photo(s) saved before failure)`,
      }
    }

    const { error } = await supabase.from('project_site_photos').insert({
      id: photoId,
      project_id: projectId,
      upload_batch_id: uploadBatchId,
      file_path: upload.filePath,
      file_name: file.name,
      file_mime_type: processed.contentType,
      uploaded_by: user.id,
      company_name: companyDetails.companyName,
      company_phone: companyDetails.companyPhone,
      milestone_id: latestStage?.milestoneId ?? null,
      stage_label: latestStage?.stageLabel ?? null,
    })

    if (error) {
      return {
        ok: false,
        error: `${getSupabaseErrorMessage(error)} (${count} photo(s) saved before failure)`,
      }
    }

    count += 1
  }

  await notifySitePhotosBatch(supabase, {
    projectId,
    uploadBatchId,
    photoCount: count,
    uploadedAt,
  })

  revalidatePhotoPaths(projectId)
  return {
    ok: true,
    data: {
      uploadBatchId,
      count,
      stageLabel: latestStage?.stageLabel ?? null,
    },
  }
}

export async function getSitePhotoStageContext(
  projectId: string,
): Promise<{ data: Awaited<ReturnType<typeof getLatestProjectStageFromExpenses>> | null; error: string | null }> {
  const supabase = await createClient()
  const stage = await getLatestProjectStageFromExpenses(supabase, projectId)
  return { data: stage, error: null }
}

export async function listSitePhotosForProject(
  projectId: string,
): Promise<{ data: ProjectSitePhoto[] | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('project_site_photos')
    .select(
      `
      *,
      uploader:profiles!uploaded_by(id, full_name),
      milestone:milestones!milestone_id(id, name)
    `,
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: (data ?? []) as ProjectSitePhoto[], error: null }
}

export async function deleteSitePhotosAction(input: {
  projectId: string
  photoIds: string[]
}): Promise<TabActionResult<{ deleted: number }>> {
  const projectId = input.projectId?.trim()
  if (!projectId) {
    return { ok: false, error: 'Project ID is required.' }
  }

  const ids = uniquePhotoIds(input.photoIds)
  if (ids.length === 0) {
    return { ok: false, error: 'Select at least one photo.' }
  }
  if (ids.length > SITE_PHOTO_UPLOAD_CONFIG.maxManageBatch) {
    return {
      ok: false,
      error: `Delete up to ${SITE_PHOTO_UPLOAD_CONFIG.maxManageBatch} photos at a time.`,
    }
  }

  const access = await requireSitePhotoManager(projectId)
  if (!access.ok) return access

  const { data: rows, error: fetchError } = await access.supabase
    .from('project_site_photos')
    .select('id, file_path')
    .eq('project_id', projectId)
    .in('id', ids)

  if (fetchError) {
    return { ok: false, error: getSupabaseErrorMessage(fetchError) }
  }

  const photos = (rows ?? []) as Array<{ id: string; file_path: string }>
  if (photos.length === 0) {
    return { ok: false, error: 'Those photos were not found on this project.' }
  }

  const { error: deleteError } = await access.supabase
    .from('project_site_photos')
    .delete()
    .eq('project_id', projectId)
    .in(
      'id',
      photos.map((photo) => photo.id),
    )

  if (deleteError) {
    return { ok: false, error: getSupabaseErrorMessage(deleteError) }
  }

  const storageResult = await deleteSitePhotosFromStorage(
    access.supabase,
    photos.map((photo) => photo.file_path),
  )
  if ('error' in storageResult) {
    console.error('[deleteSitePhotosAction] storage:', storageResult.error)
  }

  revalidatePhotoPaths(projectId)
  return { ok: true, data: { deleted: photos.length } }
}

export async function updateSitePhotosAction(input: {
  projectId: string
  photoIds: string[]
  caption?: string | null
  milestoneId?: string | null
}): Promise<TabActionResult<{ updated: number }>> {
  const projectId = input.projectId?.trim()
  if (!projectId) {
    return { ok: false, error: 'Project ID is required.' }
  }

  const ids = uniquePhotoIds(input.photoIds)
  if (ids.length === 0) {
    return { ok: false, error: 'Select at least one photo.' }
  }
  if (ids.length > SITE_PHOTO_UPLOAD_CONFIG.maxManageBatch) {
    return {
      ok: false,
      error: `Edit up to ${SITE_PHOTO_UPLOAD_CONFIG.maxManageBatch} photos at a time.`,
    }
  }

  const hasCaption = Object.prototype.hasOwnProperty.call(input, 'caption')
  const hasMilestone = Object.prototype.hasOwnProperty.call(input, 'milestoneId')
  if (!hasCaption && !hasMilestone) {
    return { ok: false, error: 'Choose a caption or a stage to update.' }
  }

  const access = await requireSitePhotoManager(projectId)
  if (!access.ok) return access

  const updates: Record<string, unknown> = {}

  if (hasCaption) {
    if (ids.length !== 1) {
      return { ok: false, error: 'Caption can only be edited for one photo at a time.' }
    }
    const trimmed = input.caption?.trim() ?? ''
    if (trimmed.length > SITE_PHOTO_UPLOAD_CONFIG.maxCaptionLength) {
      return {
        ok: false,
        error: `Caption must be ${SITE_PHOTO_UPLOAD_CONFIG.maxCaptionLength} characters or fewer.`,
      }
    }
    updates.caption = trimmed || null
  }

  if (hasMilestone) {
    const milestoneId = input.milestoneId?.trim() || null
    if (!milestoneId) {
      updates.milestone_id = null
      updates.stage_label = null
    } else {
      const { data: milestone, error: milestoneError } = await access.supabase
        .from('milestones')
        .select('id, name')
        .eq('id', milestoneId)
        .eq('project_id', projectId)
        .maybeSingle()

      if (milestoneError) {
        return { ok: false, error: getSupabaseErrorMessage(milestoneError) }
      }
      if (!milestone?.name?.trim()) {
        return { ok: false, error: 'That stage was not found on this project.' }
      }

      updates.milestone_id = milestone.id
      updates.stage_label = formatStageLabel(milestone.name)
    }
  }

  const { data, error } = await access.supabase
    .from('project_site_photos')
    .update(updates)
    .eq('project_id', projectId)
    .in('id', ids)
    .select('id')

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  const updated = data?.length ?? 0
  if (updated === 0) {
    return { ok: false, error: 'Those photos were not found on this project.' }
  }

  revalidatePhotoPaths(projectId)
  return { ok: true, data: { updated } }
}
