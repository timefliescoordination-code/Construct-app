'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { notifySitePhotosBatch } from '@/lib/notifications'
import { uploadSitePhotoFile } from '@/lib/site-photos/storage'
import { resolveSitePhotoMimeType, validateSitePhotoFile } from '@/lib/site-photos/validate'
import { SITE_PHOTO_UPLOAD_CONFIG } from '@/lib/site-photos/constants'
import type { TabActionResult } from '@/lib/projects/tab-actions'

export type ProjectSitePhoto = {
  id: string
  project_id: string
  upload_batch_id: string
  file_path: string
  file_name: string
  file_mime_type: string
  caption: string | null
  uploaded_by: string | null
  created_at: string
}

function revalidatePhotoPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/customer')
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

  if (profile?.role !== 'admin' && profile?.role !== 'pm') {
    return { ok: false, error: 'Only admins and project managers can upload site photos.' }
  }

  const uploadBatchId = crypto.randomUUID()
  const uploadedAt = new Date()
  let count = 0

  for (const file of files) {
    const photoId = crypto.randomUUID()
    const mimeType = resolveSitePhotoMimeType(file)
    const fileBuffer = await file.arrayBuffer()

    const upload = await uploadSitePhotoFile(supabase, {
      projectId,
      photoId,
      fileName: file.name,
      mimeType,
      fileBuffer,
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
      file_mime_type: mimeType,
      uploaded_by: user.id,
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
  return { ok: true, data: { uploadBatchId, count } }
}

export async function listSitePhotosForProject(
  projectId: string,
): Promise<{ data: ProjectSitePhoto[] | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('project_site_photos')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: (data ?? []) as ProjectSitePhoto[], error: null }
}
