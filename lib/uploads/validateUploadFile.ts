import 'server-only'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
])

const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png'])

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string }

export function validateUploadFile(file: File): ValidationResult {
  if (file.size > MAX_BYTES) {
    return { valid: false, error: 'File exceeds the 10 MB limit' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.has(ext)) {
    return {
      valid: false,
      error: `File type .${ext} is not allowed. Allowed: ${[...ALLOWED_EXT].join(', ')}`,
    }
  }

  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return {
      valid: false,
      error: `MIME type ${file.type} is not allowed. Allowed: PDF, JPEG, PNG`,
    }
  }

  return { valid: true }
}
