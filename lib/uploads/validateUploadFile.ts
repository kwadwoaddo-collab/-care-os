import 'server-only'
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from '@/lib/documents/constants'

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string }

export function validateUploadFile(file: File): ValidationResult {
  const maxMB = MAX_FILE_BYTES / (1024 * 1024)

  if (file.size > MAX_FILE_BYTES) {
    return { valid: false, error: `File exceeds the ${maxMB} MB limit` }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type .${ext} is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    }
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `MIME type ${file.type} is not allowed. Allowed: PDF, JPEG, PNG`,
    }
  }

  return { valid: true }
}
