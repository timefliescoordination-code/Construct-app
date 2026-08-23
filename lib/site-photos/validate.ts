import { SITE_PHOTO_UPLOAD_CONFIG } from '@/lib/site-photos/constants'
import type { FileValidationResult } from '@/lib/file-upload'
import { formatFileSize } from '@/lib/file-upload'

function extensionFromName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) return ''
  return fileName.slice(dot).toLowerCase()
}

export function validateSitePhotoFile(file: File): FileValidationResult {
  if (file.size > SITE_PHOTO_UPLOAD_CONFIG.maxFileSizeBytes) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds ${SITE_PHOTO_UPLOAD_CONFIG.maxFileSizeMB}MB.`,
    }
  }

  const ext = extensionFromName(file.name)
  const mimeOk = SITE_PHOTO_UPLOAD_CONFIG.allowedMimeTypes.includes(
    file.type as (typeof SITE_PHOTO_UPLOAD_CONFIG.allowedMimeTypes)[number],
  )
  const extOk = SITE_PHOTO_UPLOAD_CONFIG.allowedExtensions.includes(
    ext as (typeof SITE_PHOTO_UPLOAD_CONFIG.allowedExtensions)[number],
  )

  if (!mimeOk && !extOk) {
    return { valid: false, error: 'Upload JPG, PNG, or WebP images only.' }
  }

  return { valid: true }
}

export function resolveSitePhotoMimeType(file: File): string {
  if (file.type) return file.type
  const ext = extensionFromName(file.name)
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}
