import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { generateApplicationFormPdf, type PdfSection, type PdfField } from './pdf-generator'


// ── Type ──────────────────────────────────────────────────────────────────────

export interface GenerateApplicationPdfOpts {
  applicantId: string
  companyId:   string
  responseId?: string
}

// ── Field → readable section mapping ─────────────────────────────────────────

const SECTION_MAP: { title: string; slugs: string[] }[] = [
  {
    title: 'Personal Details',
    slugs: [
      'first_name', 'last_name', 'email', 'phone', 'date_of_birth',
      'national_insurance', 'address_line_1', 'address_line_2',
      'town_city', 'postcode', 'applying_for',
    ],
  },
  {
    title: 'Employment & Education History',
    slugs: ['employment_history', 'employment_gap_declarations', 'has_never_worked'],
  },
  {
    title: 'References',
    slugs: ['references'],
  },
  {
    title: 'Right to Work',
    slugs: ['right_to_work_uk', 'right_to_work_type', 'requires_sponsorship', 'visa_expiry_date', 'share_code'],
  },
  {
    title: 'Criminal Record & DBS',
    slugs: ['criminal_record'],
  },
  {
    title: 'Care Experience',
    slugs: ['previous_care_experience', 'care_experience_details', 'preferred_work_setting', 'available_start_date'],
  },
  {
    title: 'Training & Qualifications',
    slugs: ['training_qualifications', 'professional_qualifications', 'professional_registration'],
  },
  {
    title: 'Other Details',
    slugs: ['office_experience', 'application_source', 'medical_history', 'work_availability'],
  },
  {
    title: 'Emergency Contact',
    slugs: ['emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone', 'emergency_contact_email'],
  },
  {
    title: 'Declaration & Consent',
    slugs: ['declaration_consent', 'application_declarations'],
  },
]

// Flatten JSONB value to a readable string
function flattenValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '—'

  // Simple wrapper { text: '...' }
  if (typeof raw === 'object' && !Array.isArray(raw) && 'text' in (raw as Record<string,unknown>)) {
    const t = (raw as Record<string,unknown>).text
    return typeof t === 'string' ? (t.trim() || '—') : '—'
  }

  if (typeof raw === 'string') return raw.trim() || '—'
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  if (typeof raw === 'number') return String(raw)

  if (Array.isArray(raw)) {
    if (raw.length === 0) return '—'
    return raw
      .map((item, i) => {
        if (typeof item === 'object' && item !== null) {
          return (
            `${i + 1}.\n` +
            Object.entries(item as Record<string, unknown>)
              .filter(([, v]) => v !== null && v !== '' && v !== undefined)
              .map(([k, v]) => `  ${k.replace(/_/g, ' ')}: ${flattenValue(v)}`)
              .join('\n')
          )
        }
        return `${i + 1}. ${flattenValue(item)}`
      })
      .join('\n')
  }

  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${flattenValue(v)}`)
      .join('\n')
  }

  return String(raw)
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateAndStoreApplicationPdf(opts: GenerateApplicationPdfOpts): Promise<{
  ok:         boolean
  documentId: string | null
  error?:     string
}> {
  const { applicantId, companyId, responseId } = opts

  try {
    // ── 1. Load applicant ──────────────────────────────────────────────────────

    const { data: applicant } = await adminClient
      .from('applicants')
      .select('id, first_name, last_name, email, phone, job_role, company_id, companies(name)')
      .eq('id', applicantId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!applicant) return { ok: false, documentId: null, error: 'Applicant not found' }

    const companyName = (applicant.companies as { name?: string } | null)?.name ?? 'Care OS'
    const applicantName = [applicant.first_name, applicant.last_name].filter(Boolean).join(' ') || applicant.email || 'Unknown'

    // ── 2. Load form response & answers ───────────────────────────────────────

    let responseQuery = adminClient
      .from('form_responses')
      .select('id, submitted_at')
      .eq('applicant_id', applicantId)
      .eq('company_id', companyId)
      .eq('status', 'submitted')

    if (responseId) {
      responseQuery = responseQuery.eq('id', responseId)
    }

    const { data: responseRow } = await responseQuery
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!responseRow) {
      return { ok: false, documentId: null, error: 'No submitted form response found' }
    }

    const { data: answers } = await adminClient
      .from('form_answers')
      .select('value, form_fields(slug, label)')
      .eq('response_id', responseRow.id)

    const answerMap: Record<string, { label: string; value: unknown }> = {}
    for (const a of answers ?? []) {
      const field = a.form_fields as { slug?: string; label?: string } | null
      if (field?.slug) {
        answerMap[field.slug] = { label: field.label ?? field.slug, value: a.value }
      }
    }

    // ── 3. Build PDF sections ──────────────────────────────────────────────────

    const sections: PdfSection[] = []

    for (const section of SECTION_MAP) {
      const fields: PdfField[] = []
      for (const slug of section.slugs) {
        const entry = answerMap[slug]
        if (!entry) continue
        const value = flattenValue(entry.value)
        if (value !== '—') {
          fields.push({ label: entry.label, value })
        }
      }
      if (fields.length > 0) {
        sections.push({ title: section.title, fields })
      }
    }

    if (sections.length === 0) {
      return { ok: false, documentId: null, error: 'No form data to include in PDF' }
    }

    // ── 4. Generate PDF ────────────────────────────────────────────────────────

    const submittedAt = responseRow.submitted_at
      ? new Date(responseRow.submitted_at as string).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

    const pdfBytes = await generateApplicationFormPdf({
      applicantName,
      email:       applicant.email ?? '',
      phone:       applicant.phone ?? '',
      jobRole:     applicant.job_role ?? '',
      submittedAt,
      companyName,
      sections,
    })

    // ── 5. Upload to Supabase Storage ──────────────────────────────────────────

    const timestamp  = Date.now()
    const safeName   = applicantName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    const fileName   = `application-form-${safeName}-${timestamp}.pdf`
    const storagePath = `${companyId}/applicants/${applicantId}/application_form/${fileName}`

    const { error: uploadErr } = await adminClient.storage
      .from('care-os-documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadErr) {
      console.error('[application-pdf] Storage upload failed:', uploadErr.message)
      return { ok: false, documentId: null, error: uploadErr.message }
    }

    // ── 6. Resolve folder id for 'application-form-cv' ─────────────────────────

    const { data: folder } = await adminClient
      .from('staff_document_folders')
      .select('id')
      .eq('company_id', companyId)
      .eq('slug', 'application-form-cv')
      .maybeSingle()

    // ── 7. Insert document record ──────────────────────────────────────────────

    const { data: docRow, error: docErr } = await adminClient
      .from('documents')
      .insert({
        company_id:          companyId,
        applicant_id:        applicantId,
        document_type:       'application_form',
        file_name:           fileName,
        file_path:           storagePath,
        file_size:           pdfBytes.byteLength,
        mime_type:           'application/pdf',
        original_filename:   fileName,
        source_stage:        'applicant',
        source_label:        'Generated from application submission',
        folder_id:           folder?.id ?? null,
        visibility:          'management_only',
        worker_visible:      false,
        compliance_linked:   false,
        review_status:       folder?.id ? 'auto_routed' : 'unrecognised',
        requires_manual_review: !folder?.id,
        verification_status: 'approved',
        uploaded_by:         'system',
      })
      .select('id')
      .single()

    if (docErr || !docRow) {
      console.error('[application-pdf] Document insert failed:', docErr?.message)
      return { ok: false, documentId: null, error: docErr?.message ?? 'Insert failed' }
    }

    const documentId = docRow.id as string

    // ── 8. Route document & write audit log ────────────────────────────────────

    if (folder?.id) {
      await adminClient.from('document_routing_log').insert({
        company_id:          companyId,
        document_id:         documentId,
        folder_id:           folder.id,
        routing_method:      'system',
        document_type_input: 'application_form',
        matched_rule:        'application-form-cv',
        routed_by:           null,
        notes:               'Auto-routed on PDF generation',
      })
    }

    await adminClient.from('document_audit_log').insert({
      company_id:  companyId,
      document_id: documentId,
      event:       'uploaded',
      actor_type:  'system',
      actor_label: 'system',
      new_value: {
        document_type:  'application_form',
        source_label:   'Generated from application submission',
        folder_slug:    'application-form-cv',
        submitted_at:   responseRow.submitted_at,
      },
    })

    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'application_pdf.generated',
      entity_type: 'document',
      entity_id:   documentId,
      metadata: {
        applicant_id:   applicantId,
        applicant_name: applicantName,
        document_type:  'application_form',
        file_name:      fileName,
        response_id:    responseRow.id,
      },
    })

    console.log(`[application-pdf] PDF generated and stored: ${documentId}`)
    return { ok: true, documentId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[application-pdf] Unexpected error:', msg)
    return { ok: false, documentId: null, error: msg }
  }
}

// ── Link applicant PDF to staff profile after conversion ──────────────────────

export async function linkApplicationPdfToStaff(opts: {
  applicantId:    string
  staffProfileId: string
  companyId:      string
}): Promise<void> {
  const { applicantId, staffProfileId, companyId } = opts

  const { data: docs } = await adminClient
    .from('documents')
    .select('id')
    .eq('applicant_id', applicantId)
    .eq('company_id', companyId)
    .eq('document_type', 'application_form')
    .is('deleted_at', null)

  if (!docs || docs.length === 0) return

  for (const doc of docs) {
    await adminClient
      .from('documents')
      .update({ staff_profile_id: staffProfileId })
      .eq('id', doc.id)

    await adminClient.from('document_audit_log').insert({
      company_id:  companyId,
      document_id: doc.id,
      event:       'conversion_linked',
      actor_type:  'system',
      actor_label: 'system',
      new_value:   { staff_profile_id: staffProfileId },
    })
  }
}
