import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import {
  getPaginationParams,
  getRange,
  buildPaginationMeta,
} from '@/lib/pagination'

const INCIDENT_TYPES = [
  'fall', 'medication_error', 'safeguarding', 'injury',
  'behaviour', 'missed_visit', 'property_damage', 'complaint', 'other',
] as const

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
const STATUSES   = ['open', 'investigating', 'resolved', 'closed'] as const

// ── GET /api/admin/incidents ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const sp   = Object.fromEntries(request.nextUrl.searchParams.entries())
  const { page, pageSize } = getPaginationParams(sp)

  // ── Count query ───────────────────────────────────────────────────────────
  let countQ = adminClient
    .from('incidents')
    .select('id', { count: 'exact', head: true })

  // ── Data query ────────────────────────────────────────────────────────────
  let dataQ = adminClient
    .from('incidents')
    .select(`
      id, company_id, visit_note_id, shift_id, client_id, staff_profile_id,
      incident_type, severity, status, occurred_at, description,
      immediate_action_taken, escalation_required, escalated_to,
      follow_up_required, follow_up_notes, resolved_at, resolution_notes,
      created_at, updated_at,
      clients!client_id            ( id, first_name, last_name ),
      staff_profiles!staff_profile_id ( id, first_name, last_name )
    `)

  // ── Company isolation ──────────────────────────────────────────────────────
  countQ = countQ.eq('company_id', companyId)
  dataQ  = dataQ.eq('company_id', companyId)

  // ── Filters ───────────────────────────────────────────────────────────────
  const { status: statusF, severity: severityF, incident_type, client_id, staff_profile_id, visit_note_id, search } = sp

  if (statusF && STATUSES.includes(statusF as typeof STATUSES[number])) {
    countQ = countQ.eq('status', statusF)
    dataQ  = dataQ.eq('status', statusF)
  }
  if (severityF && SEVERITIES.includes(severityF as typeof SEVERITIES[number])) {
    countQ = countQ.eq('severity', severityF)
    dataQ  = dataQ.eq('severity', severityF)
  }
  if (incident_type && INCIDENT_TYPES.includes(incident_type as typeof INCIDENT_TYPES[number])) {
    countQ = countQ.eq('incident_type', incident_type)
    dataQ  = dataQ.eq('incident_type', incident_type)
  }
  if (client_id) {
    countQ = countQ.eq('client_id', client_id)
    dataQ  = dataQ.eq('client_id', client_id)
  }
  if (staff_profile_id) {
    countQ = countQ.eq('staff_profile_id', staff_profile_id)
    dataQ  = dataQ.eq('staff_profile_id', staff_profile_id)
  }
  if (visit_note_id) {
    countQ = countQ.eq('visit_note_id', visit_note_id)
    dataQ  = dataQ.eq('visit_note_id', visit_note_id)
  }
  if (search) {
    const like = `%${search}%`
    countQ = countQ.ilike('description', like)
    dataQ  = dataQ.ilike('description', like)
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  const { from, to } = getRange(page, pageSize)

  const [countResult, dataResult] = await Promise.all([
    countQ,
    dataQ.order('created_at', { ascending: false }).range(from, to),
  ])

  if (countResult.error || dataResult.error) {
    console.error('[incidents] list error:', countResult.error?.message ?? dataResult.error?.message)
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 })
  }

  const total = countResult.count ?? 0
  const meta  = buildPaginationMeta(total, page, pageSize)

  return NextResponse.json({ data: dataResult.data, meta })
}

// ── POST /api/admin/incidents ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    company_id,
    visit_note_id,
    shift_id,
    client_id,
    staff_profile_id,
    incident_type,
    severity,
    description,
    occurred_at,
    immediate_action_taken,
    escalation_required,
    escalated_to,
    follow_up_required,
    follow_up_notes,
  } = body as Record<string, string | boolean | null | undefined>

  // Validate required fields
  if (!incident_type)  return NextResponse.json({ error: 'incident_type is required' },  { status: 400 })
  if (!description)    return NextResponse.json({ error: 'description is required' },    { status: 400 })

  if (!INCIDENT_TYPES.includes(incident_type as typeof INCIDENT_TYPES[number])) {
    return NextResponse.json({ error: `Invalid incident_type: ${String(incident_type)}` }, { status: 400 })
  }
  if (severity && !SEVERITIES.includes(severity as typeof SEVERITIES[number])) {
    return NextResponse.json({ error: `Invalid severity: ${String(severity)}` }, { status: 400 })
  }

  // ── Deduplication: if visit_note_id provided, check for existing incident ──
  if (visit_note_id) {
    const { data: existing } = await adminClient
      .from('incidents')
      .select('id')
      .eq('visit_note_id', visit_note_id as string)
      .eq('company_id', companyId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'An incident already exists for this visit note', existing_incident_id: existing.id },
        { status: 409 },
      )
    }
  }

  const { data: incident, error } = await adminClient
    .from('incidents')
    .insert({
      company_id:             companyId,
      visit_note_id:          visit_note_id ?? null,
      shift_id:               shift_id ?? null,
      client_id:              client_id ?? null,
      staff_profile_id:       staff_profile_id ?? null,
      incident_type,
      severity:               severity ?? 'medium',
      status:                 'open',
      occurred_at:            occurred_at ?? new Date().toISOString(),
      description,
      immediate_action_taken: immediate_action_taken ?? null,
      escalation_required:    escalation_required ?? false,
      escalated_to:           escalated_to ?? null,
      follow_up_required:     follow_up_required ?? false,
      follow_up_notes:        follow_up_notes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[incidents] create error:', error.message)
    return NextResponse.json(
      { error: 'Failed to create incident', supabase_message: error.message },
      { status: 500 },
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'incident.created',
      entity_type: 'incident',
      entity_id:   incident.id,
      metadata:    { incident_type, severity: severity ?? 'medium', client_id, staff_profile_id },
    })
  } catch { /* non-critical */ }

  return NextResponse.json(incident, { status: 201 })
}
