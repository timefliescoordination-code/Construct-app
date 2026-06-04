import {
  DESIGN_UPLOAD_CONFIG,
  type DesignAllowedMimeType,
} from '@/lib/design/constants'
import type { FileValidationResult } from '@/lib/file-upload'
import { formatFileSize } from '@/lib/file-upload'

function extensionFromName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) return ''
  return fileName.slice(dot).toLowerCase()
}

export function validateDesignFile(file: File): FileValidationResult {
  if (file.size > DESIGN_UPLOAD_CONFIG.maxFileSizeBytes) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the maximum allowed size of ${DESIGN_UPLOAD_CONFIG.maxFileSizeMB}MB.`,
    }
  }

  const mimeAllowed = DESIGN_UPLOAD_CONFIG.allowedMimeTypes.includes(
    file.type as DesignAllowedMimeType,
  )
  const extensionAllowed = isAllowedExtension(file.name)

  if (!mimeAllowed && !extensionAllowed) {
    return {
      valid: false,
      error:
        'File type not supported. Please upload JPG, PNG, WebP, or PDF files only.',
    }
  }

  return { valid: true }
}

function isAllowedExtension(fileName: string): boolean {
  const ext = extensionFromName(fileName)
  return DESIGN_UPLOAD_CONFIG.allowedExtensions.includes(
    ext as (typeof DESIGN_UPLOAD_CONFIG.allowedExtensions)[number],
  )
}

export function resolveDesignMimeType(file: File): string {
  if (
    file.type &&
    DESIGN_UPLOAD_CONFIG.allowedMimeTypes.includes(file.type as DesignAllowedMimeType)
  ) {
    return file.type
  }

  const ext = extensionFromName(file.name)
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'

  return file.type || 'application/octet-stream'
}

export function sanitizeDesignFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'drawing'
  const cleaned = base.replace(/[^\w.\-() ]+/g, '_').trim()
  return cleaned || 'drawing'
}

export function buildDesignStoragePath(
  projectId: string,
  designFileId: string,
  fileName: string,
): string {
  const safeName = sanitizeDesignFileName(fileName)
  return `${projectId}/${designFileId}/${safeName}`
}

export function isWatermarkableImageMime(mimeType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
}
