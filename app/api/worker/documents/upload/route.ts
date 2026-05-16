import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'
import { validateUploadFile } from '@/lib/uploads/validateUploadFile'
import {
  DOCUMENT_TYPE_SET,
  DOCUMENT_TYPE_VALUES,
  TRAINING_CATEGORY_SET,
} from '@/lib/documents/constants'

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart/form-data' }, { status: 400 })
  }

  const rawToken        = formData.get('token')
  const file            = formData.get('file')
  const documentType    = formData.get('document_type')
  const expiryDate      = formData.get('expiry_date')
  const issueDate       = formData.get('issue_date')
  const trainingCategory = formData.get('training_category')

  if (typeof rawToken !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const authResult = await validateWorkerToken(rawToken)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id: staffProfileId, company_id, applicant_id } = authResult.worker

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 422 })
  }
  if (typeof documentType !== 'string' || !DOCUMENT_TYPE_SET.has(documentType)) {
    return NextResponse.json(
      { error: `document_type must be one of: ${DOCUMENT_TYPE_VALUES.join(', ')}` },
      { status: 422 }
    )
  }
  const validation = validateUploadFile(file)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }

  // Validate training_category when document type is training_certificate
  if (
    documentType === 'training_certificate' &&
    typeof trainingCategory === 'string' &&
    trainingCategory !== '' &&
    !TRAINING_CATEGORY_SET.has(trainingCategory)
  ) {
    return NextResponse.json(
      { error: 'Invalid training_category value' },
      { status: 422 }
    )
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath  = `${company_id}/worker/${staffProfileId}/${documentType}/${Date.now()}-${safeFileName}`

  const fileBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from('care-os-documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('[worker/documents/upload] storage failed:', {
      staffProfileId, documentType, message: uploadError.message,
    })
    return NextResponse.json({ error: uploadError.message ?? 'Upload failed' }, { status: 500 })
  }

  const insertPayload: Record<string, unknown> = {
    company_id,
    staff_profile_id: staffProfileId,
    document_type:    documentType,
    file_name:        file.name,
    file_path:        storagePath,
    file_size:        file.size,
    mime_type:        file.type || null,
    expiry_date:      typeof expiryDate === 'string' && expiryDate ? expiryDate : null,
    issue_date:       typeof issueDate  === 'string' && issueDate  ? issueDate  : null,
    // All worker-uploaded docs start as 'pending' — admin must approve.
    reviewed_status:  'pending',
  }

  // Include applicant_id when the worker was converted from an applicant.
  // This satisfies the legacy documents_check constraint on older Supabase
  // environments where migration 027 has not yet been applied.
  if (applicant_id) {
    insertPayload.applicant_id = applicant_id
  }

  // Persist training category when present
  if (
    documentType === 'training_certificate' &&
    typeof trainingCategory === 'string' &&
    trainingCategory &&
    TRAINING_CATEGORY_SET.has(trainingCategory)
  ) {
    insertPayload.training_category = trainingCategory
  }

  const { data: document, error: insertError } = await adminClient
    .from('documents')
    .insert(insertPayload)
    .select('id, document_type, file_name, training_category, created_at')
    .single()

  if (insertError || !document) {
    console.error('[worker/documents/upload] db insert failed:', {
      workerId: authResult.worker.id,
      staffProfileId,
      documentType,
      storagePath,
      payload: insertPayload,
      error: insertError,
      code:    insertError?.code,
      message: insertError?.message,
      details: insertError?.details,
      hint:    insertError?.hint,
    })
    
    // Attempt to map the database error to a friendly message
    let friendlyError = 'Failed to save document record'
    if (insertError?.code === '23503') { // Foreign key violation
      if (insertError.message.includes('documents_staff_profile_id_fkey')) {
        friendlyError = 'Your worker profile could not be found or is not linked correctly.'
      } else if (insertError.message.includes('uploaded_by')) {
        friendlyError = 'Upload succeeded but document registration failed due to an invalid uploaded_by reference.'
      } else {
        friendlyError = `Upload succeeded but document registration failed (FK: ${insertError.message}).`
      }
    } else if (insertError?.code === '23514') { // Check constraint violation
      if (insertError.message.includes('training_category')) {
        friendlyError = 'Document type or training category invalid.'
      } else if (insertError.message.includes('documents_check')) {
        friendlyError = 'Upload succeeded but document record could not be saved — your worker profile is not fully linked. Please contact your administrator.'
      } else if (insertError.message.includes('reviewed_status')) {
        friendlyError = 'Upload succeeded but document record could not be saved — invalid document status. Please contact your administrator.'
      } else {
        friendlyError = `Document constraint validation failed: ${insertError.message}`
      }
    } else if (insertError?.code === '42501') { // RLS policy failure
      friendlyError = 'Permission denied.'
    } else if (insertError?.message) {
      friendlyError = `Database error: ${insertError.message}`
    }

    await adminClient.storage.from('care-os-documents').remove([storagePath])
    return NextResponse.json({ error: friendlyError, details: insertError }, { status: 500 })
  }

  void adminClient.from('audit_logs').insert({
    company_id,
    actor_id:    null,
    action:      'staff.document_uploaded_by_worker',
    entity_type: 'document',
    entity_id:   document.id as string,
    metadata: {
      staff_profile_id: staffProfileId,
      document_type:    documentType,
      file_name:        file.name,
    },
  })

  return NextResponse.json({ document }, { status: 201 })
}
