/**
 * GET /api/worker/onboarding/requirements
 *
 * Returns a lightweight compliance requirements snapshot for the current worker.
 * Used by the documents page to show missing items and guide uploads.
 *
 * Response:
 *   requiredTraining:    string[]   — categories required for this role
 *   approvedCategories:  string[]   — categories with an approved, non-expired cert
 *   pendingCategories:   string[]   — categories with a pending cert (awaiting review)
 *   missingCategories:   string[]   — categories with no cert or rejected/expired cert
 *   requiredDocs:        string[]   — mandatory doc types (dbs, right_to_work, id, proof_of_address)
 *   uploadedDocTypes:    string[]   — doc types present in any reviewed_status
 *   missingDocs:         string[]   — required docs not yet uploaded
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { validateWorkerToken }       from '@/lib/worker/auth'
import { getRequiredTraining }       from '@/lib/training/matrix'
import { calculateCompliance }       from '@/lib/compliance/calculateCompliance'
import { explainCompliance }         from '@/lib/compliance/explainability'
import type { ComplianceDocument }   from '@/lib/compliance/calculateCompliance'

// Mandatory document types (mirrors calculateOnboardingStatus)
const REQUIRED_DOC_TYPES = ['dbs', 'right_to_work', 'id', 'proof_of_address']

// Passport satisfies both id and right_to_work
const PASSPORT_EXPANDS = new Set(['id', 'right_to_work'])

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const auth  = await validateWorkerToken(token)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: staffProfileId, applicant_id, job_role } = auth.worker

  // Fetch profile for job_role (already in auth.worker)
  // Fetch all documents
  const [staffRes, applicantRes] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, document_type, training_category, reviewed_status, expiry_date, file_name, issue_date')
      .eq('staff_profile_id', staffProfileId),

    applicant_id
      ? adminClient
          .from('documents')
          .select('id, document_type, training_category, reviewed_status, expiry_date, file_name, issue_date')
          .eq('applicant_id', applicant_id)
      : Promise.resolve({ data: [], error: null }),
  ])

  const seen = new Set<string>()
  const docs: ComplianceDocument[] = []
  for (const d of [...(staffRes.data ?? []), ...(applicantRes.data ?? [])] as ComplianceDocument[]) {
    if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
  }

  // Use compliance engine for training breakdown (role-aware)
  const compliance = calculateCompliance(docs, job_role ?? null)

  // Build required doc coverage
  const now            = new Date()
  const uploadedTypes  = new Set(docs.map((d) => d.document_type))
  // Expand passport
  if (uploadedTypes.has('passport')) {
    PASSPORT_EXPANDS.forEach((t) => uploadedTypes.add(t))
  }
  const missingDocs = REQUIRED_DOC_TYPES.filter((t) => !uploadedTypes.has(t))

  // Build training breakdown by category
  const requiredTraining   = getRequiredTraining(job_role ?? null)
  const approvedCategories = compliance.satisfiedTraining
  const approvedSet        = new Set(approvedCategories)

  // Pending = has a pending cert for this category (no approved one yet)
  const pendingCategories: string[] = []
  const pendingMap = new Map<string, boolean>() // category → has pending

  for (const d of docs) {
    if (
      d.document_type     === 'training_certificate' &&
      d.training_category &&
      d.reviewed_status   === 'pending'
    ) {
      pendingMap.set(d.training_category, true)
    }
  }

  for (const cat of requiredTraining) {
    if (!approvedSet.has(cat) && pendingMap.has(cat)) {
      pendingCategories.push(cat)
    }
  }

  const pendingSet        = new Set(pendingCategories)
  const missingCategories = requiredTraining.filter(
    (cat) => !approvedSet.has(cat) && !pendingSet.has(cat)
  )

  // Build explainability breakdown for the worker
  const breakdown = explainCompliance(compliance, docs, requiredTraining)

  // Worker-facing action list: prioritised by impact
  const nextActions = breakdown.issues
    .filter((r) => r.status === 'missing' || r.status === 'expired')
    .slice(0, 3)
    .map((r) => ({ label: r.label, action: r.action, status: r.status, impact: r.impact }))

  return NextResponse.json({
    requiredTraining,
    approvedCategories,
    pendingCategories,
    missingCategories,
    requiredDocs:    REQUIRED_DOC_TYPES,
    uploadedDocTypes: [...uploadedTypes],
    missingDocs,
    // Compliance status (new — for worker portal explainability)
    complianceState:      compliance.complianceState,
    compliancePercentage: compliance.percentage,
    primaryBlocker:       breakdown.primaryBlocker,
    stateExplanation:     breakdown.stateExplanation,
    nextActions,
  })
}
