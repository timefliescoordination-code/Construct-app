import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY_ASSETS_BUCKET, COMPANY_LOGO_PATH } from '@/lib/company/constants'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/svg+xml') return 'svg'
  return 'jpg'
}

export function buildCompanyLogoStoragePath(mimeType: string): string {
  return `${COMPANY_LOGO_PATH}.${extensionForMime(mimeType)}`
}

export async function uploadCompanyLogoFile(
  supabase: SupabaseClient,
  mimeType: string,
  fileBuffer: Buffer | ArrayBuffer,
): Promise<{ filePath: string } | { error: string }> {
  const filePath = buildCompanyLogoStoragePath(mimeType)
  const body = fileBuffer instanceof Buffer ? fileBuffer : Buffer.from(fileBuffer)

  const { error } = await supabase.storage
    .from(COMPANY_ASSETS_BUCKET)
    .upload(filePath, body, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { filePath }
}

export function getCompanyLogoPublicUrl(
  supabase: SupabaseClient,
  logoPath: string | null | undefined,
): string | null {
  if (!logoPath) return null

  const { data } = supabase.storage.from(COMPANY_ASSETS_BUCKET).getPublicUrl(logoPath)
  return data.publicUrl || null
}

export async function deleteCompanyLogoFile(
  supabase: SupabaseClient,
  logoPath: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.storage.from(COMPANY_ASSETS_BUCKET).remove([logoPath])

  if (error) {
    return { error: getSupabaseErrorMessage(error) }
  }

  return { ok: true }
}
