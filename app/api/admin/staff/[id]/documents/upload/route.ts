import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateUploadFile } from '@/lib/uploads/validateUploadFile'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { ipRateLimit } from '@/lib/rateLimit'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import {
  DOCUMENT_TYPE_SET,
  DOCUMENT_TYPE_VALUES,
  uploadDocumentSchema,
} from '@/lib/documents/constants'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 20 uploads per hour per IP
  const rl = ipRateLimit(request, 'doc:upload', 20, 60 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many uploads — try again later' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rl.retryAfter / 1000)) },
    })
  }

  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'documents:upload')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  // ── Fetch staff profile ────────────────────────────────────────────────────
  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, applicant_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spError) {
    console.error('[staff/documents/upload] staff profile lookup failed:', {
      staffProfileId, message: spError.message,
    })
    return NextResponse.json({ error: 'Failed to look up staff profile' }, { status: 500 })
  }
  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // ── Parse multipart/form-data ──────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart/form-data body' }, { status: 400 })
  }

  const file         = formData.get('file')
  const documentType = formData.get('document_type')
  const expiryDate   = formData.get('expiry_date')
  const trainingName = formData.get('training_name')

  // ── Validate required fields ───────────────────────────────────────────────
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 422 })
  }

  if (typeof documentType !== 'string' || !DOCUMENT_TYPE_SET.has(documentType)) {
    return NextResponse.json(
      { error: `document_type must be one of: ${DOCUMENT_TYPE_VALUES.join(', ')}` },
      { status: 422 }
    )
  }

  const parsed = uploadDocumentSchema.safeParse({
    documentType,
    expiryDate:   typeof expiryDate === 'string' ? expiryDate : undefined,
    trainingName: typeof trainingName === 'string' ? trainingName : undefined,
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  // ── Validate file ──────────────────────────────────────────────────────────
  const validation = validateUploadFile(file)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }
  const originalName = file.name

  // ── Build storage path ─────────────────────────────────────────────────────
  const safeFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath  = `${companyId}/staff/${staffProfileId}/${documentType}/${Date.now()}-${safeFileName}`

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const fileBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from('care-os-documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('[staff/documents/upload] storage upload failed:', {
      staffProfileId,
      documentType,
      storagePath,
      message: uploadError.message,
    })
    return NextResponse.json(
      { error: uploadError.message ?? 'Failed to upload file' },
      { status: 500 }
    )
  }

  // ── Insert DB row ──────────────────────────────────────────────────────────
  const insertPayload: Record<string, unknown> = {
    company_id:       companyId,
    staff_profile_id: staffProfileId,
    document_type:    documentType,
    file_name:        originalName,
    file_path:        storagePath,
    file_size:        file.size,
    mime_type:        file.type || null,
    expiry_date:      parsed.data.expiryDate || null,
  }

  if (staffProfile.applicant_id) {
    insertPayload.applicant_id = staffProfile.applicant_id
  }

  if (documentType === 'training_certificate' && parsed.data.trainingName) {
    insertPayload.training_name = parsed.data.trainingName
  }

  const { data: document, error: insertError } = await adminClient
    .from('documents')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertError || !document) {
    console.error('[staff/documents/upload] db insert failed:', {
      staffProfileId,
      documentType,
      code:    insertError?.code,
      message: insertError?.message,
      details: insertError?.details,
      hint:    insertError?.hint,
    })
    // Best-effort cleanup: remove the orphaned storage object
    await adminClient.storage.from('care-os-documents').remove([storagePath])
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to save document record' },
      { status: 500 }
    )
  }

  // ── Audit log (fire-and-forget) ────────────────────────────────────────────
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
      if (error) console.error('[staff/documents/upload] audit log failed:', error.message)
    } catch (err) {
      console.error('[staff/documents/upload] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ document }, { status: 201 })
}
