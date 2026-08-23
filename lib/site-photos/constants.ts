export const PROJECT_SITE_PHOTOS_BUCKET = 'project-site-photos'

export const SITE_PHOTO_UPLOAD_CONFIG = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFileSizeMB: 10,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'] as const,
  maxFilesPerBatch: 20,
}
