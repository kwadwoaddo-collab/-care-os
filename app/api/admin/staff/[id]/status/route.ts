import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { calculateCompliance } from '@/lib/compliance/calculateCompliance'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

const ALLOWED_STATUSES = new Set(['pre_employment', 'active', 'suspended', 'inactive'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: staffProfileId } = await params

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status =
    body && typeof body === 'object' && 'status' in body
      ? (body as Record<string, unknown>).status
      : undefined

  if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
      { status: 422 }
    )
  }

  // ── Fetch staff profile ─────────────────────────────────────────────────────
  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, applicant_id, status')
    .eq('id', staffProfileId)
    .maybeSingle()

  if (spError) {
    console.error('[staff/status] fetch error:', spError.message)
    return NextResponse.json({ error: 'Failed to fetch staff profile' }, { status: 500 })
  }
  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const companyId = staffProfile.company_id as string

  // ── Compliance gate for "active" ────────────────────────────────────────────
  if (status === 'active') {
    // Gather all documents for this staff member
    let documents: { id: string; document_type: string; file_name: string; expiry_date: string | null }[] = []

    // Fetch by staff_profile_id first (newly uploaded staff docs)
    const { data: staffDocs } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date')
      .eq('staff_profile_id', staffProfileId)

    if (staffDocs) documents.push(...staffDocs)

    // Also fetch by applicant_id (docs uploaded via applicant flow)
    if (staffProfile.applicant_id) {
      const { data: applicantDocs } = await adminClient
        .from('documents')
        .select('id, document_type, file_name, expiry_date')
        .eq('applicant_id', staffProfile.applicant_id)
      if (applicantDocs) documents.push(...applicantDocs)
    }

    // Deduplicate by id
    const seen = new Set<string>()
    documents = documents.filter((d) => {
      if (seen.has(d.id)) return false
      seen.add(d.id)
      return true
    })

    const compliance = calculateCompliance(documents)

    if (!compliance.compliant) {
      // Audit log — activation blocked (fire-and-forget)
      void (async () => {
        try {
          await adminClient.from('audit_logs').insert({
            company_id:  companyId,
            actor_id:    null,
            action:      'staff.activation_blocked',
            entity_type: 'staff_profile',
            entity_id:   staffProfileId,
            metadata: {
              missing_documents: compliance.missingDocuments,
              expired_documents: compliance.expiredDocuments,
              missing_training:  compliance.missingTraining,
              timestamp:         new Date().toISOString(),
            },
          })
        } catch (err) {
          console.error('[staff/status] activation_blocked audit log error:', err)
        }
      })()

      return NextResponse.json(
        {
          error: 'Staff cannot be activated until mandatory compliance is complete.',
          compliance: {
            percentage:        compliance.percentage,
            missingDocuments:  compliance.missingDocuments,
            expiredDocuments:  compliance.expiredDocuments,
            missingTraining:   compliance.missingTraining,
          },
        },
        { status: 422 }
      )
    }
  }

  // ── Update status ───────────────────────────────────────────────────────────
  const { data: updated, error: updateError } = await adminClient
    .from('staff_profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', staffProfileId)
    .select('id, status, updated_at')
    .single()

  if (updateError || !updated) {
    console.error('[staff/status] update error:', updateError?.message)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  // ── Audit log — status updated (fire-and-forget) ────────────────────────────
  void (async () => {
    try {
      const { error } = await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    null,
        action:      'staff.status_updated',
        entity_type: 'staff_profile',
        entity_id:   staffProfileId,
        metadata: {
          previous_status: staffProfile.status,
          new_status:      status,
          timestamp:       new Date().toISOString(),
        },
      })
      if (error) console.error('[staff/status] audit log failed:', error)
    } catch (err) {
      console.error('[staff/status] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ staff_profile: updated })
}
