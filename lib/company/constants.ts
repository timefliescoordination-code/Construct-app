export const COMPANY_ASSETS_BUCKET = 'company-assets'

export const COMPANY_LOGO_PATH = 'logo/company-logo'

export const COMPANY_SETTINGS_ID = 'default'

export const COMPANY_LOGO_CONFIG = {
  maxFileSizeBytes: 2 * 1024 * 1024,
  maxFileSizeMB: 2,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const,
}
