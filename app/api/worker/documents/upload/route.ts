import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png'])
const ALLOWED_MIME_TYPES  = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const DOCUMENT_TYPES = new Set([
  'passport',
  'right_to_work',
  'dbs',
  'training_certificate',
  'qualification',
  'proof_of_address',
  'national_insurance',
  'other',
])

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart/form-data' }, { status: 400 })
  }

  const rawToken     = formData.get('token')
  const file         = formData.get('file')
  const documentType = formData.get('document_type')
  const expiryDate   = formData.get('expiry_date')

  if (typeof rawToken !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const authResult = await validateWorkerToken(rawToken)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id: staffProfileId, company_id } = authResult.worker

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 422 })
  }
  if (typeof documentType !== 'string' || !DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json(
      { error: `document_type must be one of: ${[...DOCUMENT_TYPES].join(', ')}` },
      { status: 422 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 10 MB limit' }, { status: 422 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `File type .${ext} is not allowed` }, { status: 422 })
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: `MIME type ${file.type} is not allowed` }, { status: 422 })
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
    console.error('[worker/documents/upload] storage error:', uploadError)
    return NextResponse.json({ error: uploadError.message ?? 'Upload failed' }, { status: 500 })
  }

  const { data: document, error: insertError } = await adminClient
    .from('documents')
    .insert({
      company_id,
      staff_profile_id: staffProfileId,
      document_type:    documentType,
      file_name:        file.name,
      file_path:        storagePath,
      file_size:        file.size,
      mime_type:        file.type || null,
      expiry_date:      typeof expiryDate === 'string' && expiryDate ? expiryDate : null,
      uploaded_by:      'worker',
    })
    .select('id, document_type, file_name, created_at')
    .single()

  if (insertError || !document) {
    console.error('[worker/documents/upload] db insert error:', insertError)
    await adminClient.storage.from('care-os-documents').remove([storagePath])
    return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 })
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
