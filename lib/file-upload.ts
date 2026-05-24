// File upload configuration and validation
export const FILE_UPLOAD_CONFIG = {
  maxFileSizeKB: 500,
  maxFileSizeBytes: 500 * 1024, // 500KB in bytes
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/heic'],
  allowedDocumentTypes: ['image/jpeg', 'image/png', 'application/pdf'],
}

export interface FileValidationResult {
  valid: boolean
  error?: string
}

export function validateFileSize(file: File): FileValidationResult {
  if (file.size > FILE_UPLOAD_CONFIG.maxFileSizeBytes) {
    const fileSizeKB = Math.round(file.size / 1024)
    return {
      valid: false,
      error: `File size (${fileSizeKB}KB) exceeds the maximum allowed size of ${FILE_UPLOAD_CONFIG.maxFileSizeKB}KB`
    }
  }
  return { valid: true }
}

export function validateImageFile(file: File): FileValidationResult {
  const sizeValidation = validateFileSize(file)
  if (!sizeValidation.valid) {
    return sizeValidation
  }

  if (!FILE_UPLOAD_CONFIG.allowedImageTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported. Please upload JPG, PNG, or HEIC files only.`
    }
  }

  return { valid: true }
}

export function validateDocumentFile(file: File): FileValidationResult {
  const sizeValidation = validateFileSize(file)
  if (!sizeValidation.valid) {
    return sizeValidation
  }

  if (!FILE_UPLOAD_CONFIG.allowedDocumentTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported. Please upload JPG, PNG, or PDF files only.`
    }
  }

  return { valid: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}
