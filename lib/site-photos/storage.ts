import type { SupabaseClient } from '@supabase/supabase-js'
import { PROJECT_SITE_PHOTOS_BUCKET } from '@/lib/site-photos/constants'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export function buildSitePhotoStoragePath(
  projectId: string,
  photoId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${projectId}/${photoId}/${safeName}`
}

export async function uploadSitePhotoFile(
  supabase: SupabaseClient,
  input: {
    projectId: string
    photoId: string
    fileName: string
    mimeType: string
    fileBuffer: ArrayBuffer
  },
): Promise<{ filePath: string } | { error: string }> {
  const filePath = buildSitePhotoStoragePath(
    input.projectId,
    input.photoId,
    input.fileName,
  )

  const { error } = await supabase.storage
    .from(PROJECT_SITE_PHOTOS_BUCKET)
    .upload(filePath, input.fileBuffer, {
      contentType: input.mimeType,
      upsert: false,
    })

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { filePath }
}

export async function createSignedSitePhotoUrl(
  supabase: SupabaseClient,
  filePath: string,
  expiresInSeconds = 3600,
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(PROJECT_SITE_PHOTOS_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    return { error: error ? getSupabaseErrorMessage(error) : 'Failed to create URL.' }
  }

  return { url: data.signedUrl }
}

export async function deleteSitePhotoFromStorage(
  supabase: SupabaseClient,
  filePath: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.storage
    .from(PROJECT_SITE_PHOTOS_BUCKET)
    .remove([filePath])

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { ok: true }
}
