import type { SupabaseClient } from '@supabase/supabase-js'
import { QUALITY_INSPECTION_PHOTOS_BUCKET } from '@/lib/quality/constants'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export function buildQualityPhotoStoragePath(
  projectId: string,
  inspectionId: string,
  photoId: string,
  mimeType: string,
): string {
  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg'
  return `${projectId}/${inspectionId}/${photoId}.${ext}`
}

export async function uploadQualityPhotoFile(
  supabase: SupabaseClient,
  input: {
    projectId: string
    inspectionId: string
    photoId: string
    mimeType: string
    fileBuffer: Buffer | ArrayBuffer
  },
): Promise<{ filePath: string } | { error: string }> {
  const filePath = buildQualityPhotoStoragePath(
    input.projectId,
    input.inspectionId,
    input.photoId,
    input.mimeType,
  )
  const body = Buffer.isBuffer(input.fileBuffer)
    ? input.fileBuffer
    : Buffer.from(new Uint8Array(input.fileBuffer))

  const { error } = await supabase.storage
    .from(QUALITY_INSPECTION_PHOTOS_BUCKET)
    .upload(filePath, body, { contentType: input.mimeType, upsert: false })

  if (error) return { error: getSupabaseErrorMessage(error) }
  return { filePath }
}

export async function downloadQualityPhotoFile(
  supabase: SupabaseClient,
  filePath: string,
): Promise<{ data: Blob; mimeType: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(QUALITY_INSPECTION_PHOTOS_BUCKET)
    .download(filePath)

  if (error || !data) {
    return { error: error ? getSupabaseErrorMessage(error) : 'Failed to download photo.' }
  }
  return { data, mimeType: data.type || 'image/jpeg' }
}
