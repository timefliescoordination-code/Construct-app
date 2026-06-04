export const PROJECT_DESIGN_BUCKET = 'project-designs'

export const DESIGN_UPLOAD_CONFIG = {
  maxFileSizeBytes: 20 * 1024 * 1024,
  maxFileSizeMB: 20,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ] as const,
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'] as const,
}

export type DesignAllowedMimeType =
  (typeof DESIGN_UPLOAD_CONFIG.allowedMimeTypes)[number]

export const DEFAULT_WATERMARK_TEXT = 'VRA HOMES'
