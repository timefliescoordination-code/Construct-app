import type { SupabaseClient } from '@supabase/supabase-js'
import { CONSTRUCTION_CHANGE_FILES_BUCKET } from '@/lib/change-requests/constants'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export function buildChangeRequestAttachmentPath(
  changeRequestId: string,
  attachmentId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${changeRequestId}/${attachmentId}/${safeName}`
}

export async function uploadChangeRequestFile(
  supabase: SupabaseClient,
  input: {
    changeRequestId: string
    attachmentId: string
    fileName: string
    mimeType: string
    fileBuffer: Buffer | ArrayBuffer
  },
): Promise<{ filePath: string } | { error: string }> {
  const filePath = buildChangeRequestAttachmentPath(
    input.changeRequestId,
    input.attachmentId,
    input.fileName,
  )

  const body =
    input.fileBuffer instanceof Buffer ? input.fileBuffer : Buffer.from(input.fileBuffer)

  const { error } = await supabase.storage
    .from(CONSTRUCTION_CHANGE_FILES_BUCKET)
    .upload(filePath, body, { contentType: input.mimeType, upsert: false })

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { filePath }
}

export async function createSignedChangeRequestUrl(
  supabase: SupabaseClient,
  filePath: string,
  expiresInSeconds = 3600,
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(CONSTRUCTION_CHANGE_FILES_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    return { error: error ? getSupabaseErrorMessage(error) : 'Failed to create URL.' }
  }

  return { url: data.signedUrl }
}

export async function deleteChangeRequestFile(
  supabase: SupabaseClient,
  filePath: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.storage
    .from(CONSTRUCTION_CHANGE_FILES_BUCKET)
    .remove([filePath])

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { ok: true }
}
