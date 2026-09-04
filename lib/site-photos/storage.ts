import type { SupabaseClient } from '@supabase/supabase-js'
import { PROJECT_SITE_PHOTOS_BUCKET } from '@/lib/site-photos/constants'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export function buildSitePhotoStoragePath(
  projectId: string,
  uploadBatchId: string,
  photoId: string,
  mimeType: string,
): string {
  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg'
  return `${projectId}/${uploadBatchId}/${photoId}.${ext}`
}

export async function uploadSitePhotoFile(
  supabase: SupabaseClient,
  input: {
    projectId: string
    uploadBatchId: string
    photoId: string
    mimeType: string
    fileBuffer: Buffer | ArrayBuffer
  },
): Promise<{ filePath: string } | { error: string }> {
  const filePath = buildSitePhotoStoragePath(
    input.projectId,
    input.uploadBatchId,
    input.photoId,
    input.mimeType,
  )

  const body =
    input.fileBuffer instanceof Buffer ? input.fileBuffer : Buffer.from(input.fileBuffer)

  const { error } = await supabase.storage
    .from(PROJECT_SITE_PHOTOS_BUCKET)
    .upload(filePath, body, {
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
  return deleteSitePhotosFromStorage(supabase, [filePath])
}

export async function deleteSitePhotosFromStorage(
  supabase: SupabaseClient,
  filePaths: string[],
): Promise<{ ok: true } | { error: string }> {
  const paths = [...new Set(filePaths.filter(Boolean))]
  if (paths.length === 0) return { ok: true }

  const { error } = await supabase.storage.from(PROJECT_SITE_PHOTOS_BUCKET).remove(paths)

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { ok: true }
}

export async function downloadSitePhotoFile(
  supabase: SupabaseClient,
  filePath: string,
): Promise<{ data: Blob; mimeType: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(PROJECT_SITE_PHOTOS_BUCKET)
    .download(filePath)

  if (error || !data) {
    return { error: error ? getSupabaseErrorMessage(error) : 'Failed to download photo.' }
  }

  return { data, mimeType: data.type || 'image/jpeg' }
}
