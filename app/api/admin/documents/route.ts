import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateUploadFile } from '@/lib/uploads/validateUploadFile'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const DOCUMENT_TYPES = new Set([
  'passport',
  'right_to_work',
  'dbs',
  'cv',
  'qualification',
  'training_certificate',
  'proof_of_address',
  'national_insurance',
  'other',
])

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const applicantId = searchParams.get('applicant_id')

  if (!applicantId) {
    return NextResponse.json({ error: 'applicant_id query param required' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('documents')
    .select('id, applicant_id, staff_profile_id, company_id, document_type, file_name, file_path, file_size, mime_type, expiry_date, created_at')
    .eq('applicant_id', applicantId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[admin/documents] fetch failed:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  // ── Parse multipart/form-data ─────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart/form-data body' }, { status: 400 })
  }

  const file          = formData.get('file')
  const applicantId   = formData.get('applicant_id')
  const documentType  = formData.get('document_type')
  const expiryDate    = formData.get('expiry_date')   // optional ISO date string
  const uploadedBy    = formData.get('uploaded_by')   // optional label

  // ── Validate required fields ──────────────────────────────────────────────
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 422 })
  }
  if (typeof applicantId !== 'string' || !applicantId) {
    return NextResponse.json({ error: 'applicant_id is required' }, { status: 422 })
  }
  if (typeof documentType !== 'string' || !DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json(
      { error: `document_type must be one of: ${[...DOCUMENT_TYPES].join(', ')}` },
      { status: 422 }
    )
  }

  // ── Validate file ─────────────────────────────────────────────────────────
  const validation = validateUploadFile(file)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }
  const originalName = file.name

  // ── Fetch applicant for company_id ────────────────────────────────────────
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('id, company_id')
    .eq('id', applicantId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (applicantError) {
    console.error('[admin/documents] applicant lookup failed:', applicantError)
    return NextResponse.json({ error: 'Failed to look up applicant' }, { status: 500 })
  }
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }


  // ── Build storage path ─────────────────────────────────────────────────────
  // Pattern: company_id/applicant_id/document-type/timestamp-filename.ext
  const safeFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath  = `${companyId}/${applicantId}/${documentType}/${Date.now()}-${safeFileName}`

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const fileBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from('care-os-documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('[admin/documents] storage upload failed:', uploadError)
    return NextResponse.json(
      { error: uploadError.message ?? 'Failed to upload file' },
      { status: 500 }
    )
  }

  // ── Insert DB row ──────────────────────────────────────────────────────────
  const { data: document, error: insertError } = await adminClient
    .from('documents')
    .insert({
      company_id:    companyId,
      applicant_id:  applicantId,
      document_type: documentType,
      file_name:     originalName,
      file_path:     storagePath,
      file_size:     file.size,
      mime_type:     file.type || null,
      expiry_date:   typeof expiryDate === 'string' && expiryDate ? expiryDate : null,
      uploaded_by:   typeof uploadedBy === 'string' && uploadedBy ? uploadedBy : null,
    })
    .select('*')
    .single()

  if (insertError || !document) {
    console.error('[admin/documents] db insert failed:', {
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
        action:      'document.uploaded',
        entity_type: 'document',
        entity_id:   document.id as string,
        metadata: {
          applicant_id:  applicantId,
          document_type: documentType,
          file_name:     originalName,
          timestamp:     new Date().toISOString(),
        },
      })
      if (error) console.error('[admin/documents] audit log failed:', error)
    } catch (err) {
      console.error('[admin/documents] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ document }, { status: 201 })
}
