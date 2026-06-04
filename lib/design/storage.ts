import type { SupabaseClient } from '@supabase/supabase-js'
import { PROJECT_DESIGN_BUCKET } from '@/lib/design/constants'
import { buildDesignStoragePath } from '@/lib/design/validate'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export type UploadDesignFileInput = {
  projectId: string
  designFileId: string
  fileName: string
  mimeType: string
  fileBuffer: ArrayBuffer
}

async function uploadToDesignBucket(
  supabase: SupabaseClient,
  filePath: string,
  body: ArrayBuffer,
  mimeType: string,
): Promise<{ filePath: string } | { error: string }> {
  const { error } = await supabase.storage
    .from(PROJECT_DESIGN_BUCKET)
    .upload(filePath, body, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { filePath }
}

export async function uploadDesignFile(
  supabase: SupabaseClient,
  input: UploadDesignFileInput,
): Promise<{ filePath: string } | { error: string }> {
  const filePath = buildDesignStoragePath(
    input.projectId,
    input.designFileId,
    input.fileName,
  )

  return uploadToDesignBucket(supabase, filePath, input.fileBuffer, input.mimeType)
}

export async function deleteDesignFileFromStorage(
  supabase: SupabaseClient,
  filePath: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.storage.from(PROJECT_DESIGN_BUCKET).remove([filePath])

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { ok: true }
}

export async function createSignedDesignFileUrl(
  supabase: SupabaseClient,
  filePath: string,
  expiresInSeconds = 3600,
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(PROJECT_DESIGN_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    return { error: error ? getSupabaseErrorMessage(error) : 'Failed to create download URL.' }
  }

  return { url: data.signedUrl }
}

export async function downloadDesignFileBuffer(
  supabase: SupabaseClient,
  filePath: string,
): Promise<{ buffer: Buffer } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(PROJECT_DESIGN_BUCKET)
    .download(filePath)

  if (error || !data) {
    return { error: error ? getSupabaseErrorMessage(error) : 'Failed to download file.' }
  }

  const arrayBuffer = await data.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer) }
}
