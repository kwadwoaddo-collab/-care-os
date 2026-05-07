import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateUploadFile } from '@/lib/uploads/validateUploadFile'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: staffProfileId } = await params

  // ── Fetch staff profile for company_id ─────────────────────────────────────
  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, applicant_id')
    .eq('id', staffProfileId)
    .maybeSingle()

  if (spError) {
    console.error('[staff/documents/upload] staff profile lookup failed:', spError.message)
    return NextResponse.json({ error: 'Failed to look up staff profile' }, { status: 500 })
  }
  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const companyId = staffProfile.company_id as string

  // ── Parse multipart/form-data ───────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart/form-data body' }, { status: 400 })
  }

  const file          = formData.get('file')
  const documentType  = formData.get('document_type')
  const expiryDate    = formData.get('expiry_date')    // optional ISO date string
  const trainingName  = formData.get('training_name')  // optional, for training_certificate

  // ── Validate required fields ────────────────────────────────────────────────
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 422 })
  }
  if (typeof documentType !== 'string' || !DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json(
      { error: `document_type must be one of: ${[...DOCUMENT_TYPES].join(', ')}` },
      { status: 422 }
    )
  }

  // ── Validate file ───────────────────────────────────────────────────────────
  const validation = validateUploadFile(file)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }
  const originalName = file.name

  // ── Build storage path ──────────────────────────────────────────────────────
  // Pattern: company_id/staff/staff_profile_id/document_type/timestamp-filename.ext
  const safeFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath  = `${companyId}/staff/${staffProfileId}/${documentType}/${Date.now()}-${safeFileName}`

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
  const fileBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from('care-os-documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('[staff/documents/upload] storage upload failed:', uploadError)
    return NextResponse.json(
      { error: uploadError.message ?? 'Failed to upload file' },
      { status: 500 }
    )
  }

  // ── Insert DB row ───────────────────────────────────────────────────────────
  // Link to staff_profile_id. Also link to applicant_id if available (for compliance engine).
  const insertPayload: Record<string, unknown> = {
    company_id:       companyId,
    document_type:    documentType,
    file_name:        originalName,
    file_path:        storagePath,
    file_size:        file.size,
    mime_type:        file.type || null,
    expiry_date:      typeof expiryDate === 'string' && expiryDate ? expiryDate : null,
    staff_profile_id: staffProfileId,
  }

  // Only add applicant_id if the column exists and there's a linked applicant
  if (staffProfile.applicant_id) {
    insertPayload.applicant_id = staffProfile.applicant_id
  }

  // Add training_name for training certificates
  if (documentType === 'training_certificate' && typeof trainingName === 'string' && trainingName) {
    insertPayload.training_name = trainingName
  }

  const { data: document, error: insertError } = await adminClient
    .from('documents')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertError || !document) {
    console.error('[staff/documents/upload] db insert failed:', {
      message: insertError?.message,
      code:    insertError?.code,
      details: insertError?.details,
    })
    // Best-effort cleanup: remove the orphaned storage object
    await adminClient.storage.from('care-os-documents').remove([storagePath])
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to save document record' },
      { status: 500 }
    )
  }

  // ── Audit log (fire-and-forget) ─────────────────────────────────────────────
  void (async () => {
    try {
      const { error } = await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    null,
        action:      'staff.document_uploaded',
        entity_type: 'staff_profile',
        entity_id:   staffProfileId,
        metadata: {
          document_id:      document.id,
          document_type:    documentType,
          file_name:        originalName,
          staff_profile_id: staffProfileId,
          timestamp:        new Date().toISOString(),
        },
      })
      if (error) console.error('[staff/documents/upload] audit log failed:', error)
    } catch (err) {
      console.error('[staff/documents/upload] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ document }, { status: 201 })
}
