import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import { forbidden }                 from '@/lib/auth/responses'
import { scoreIncident }             from '@/lib/incidents/riskEngine'

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
const STATUSES   = ['open', 'investigating', 'resolved', 'closed'] as const

const PATCH_ALLOWED = [
  'incident_type', 'severity', 'status', 'description',
  'immediate_action_taken', 'escalation_required', 'escalated_to',
  'follow_up_required', 'follow_up_notes', 'resolution_notes',
] as const

// ── GET /api/admin/incidents/[id] ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id } = await params

  const { data, error } = await adminClient
    .from('incidents')
    .select(`
      *,
      clients!client_id            ( id, first_name, last_name ),
      staff_profiles!staff_profile_id ( id, first_name, last_name, email ),
      shifts!shift_id              ( id, title, shift_date, start_time, end_time ),
      visit_notes!visit_note_id    ( id, status, incident_notes, created_at )
    `)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    console.error('[incidents/[id]] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch incident' }, { status: 500 })
  }

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}

// ── PATCH /api/admin/incidents/[id] ───────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:write')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build updates from allowed fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  for (const key of PATCH_ALLOWED) {
    if (key in body) updates[key] = body[key] ?? null
  }

  // Validate severity & status if provided
  if (updates.severity && !SEVERITIES.includes(updates.severity as typeof SEVERITIES[number])) {
    return NextResponse.json({ error: `Invalid severity: ${String(updates.severity)}` }, { status: 400 })
  }
  if (updates.status && !STATUSES.includes(updates.status as typeof STATUSES[number])) {
    return NextResponse.json({ error: `Invalid status: ${String(updates.status)}` }, { status: 400 })
  }

  // Recompute risk score if severity, type, escalation, or action changed
  const riskFields = ['severity', 'incident_type', 'escalation_required', 'immediate_action_taken']
  const needsRescoring = riskFields.some((f) => f in body)
  if (needsRescoring) {
    // Fetch current incident to fill missing fields
    const { data: cur } = await adminClient
      .from('incidents')
      .select('severity, incident_type, escalation_required, immediate_action_taken, client_id, staff_profile_id, company_id')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (cur) {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const effectiveType = (updates.incident_type ?? cur.incident_type) as string

      const [clientRepeat, workerRepeat] = await Promise.all([
        cur.client_id
          ? adminClient
              .from('incidents')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', companyId)
              .eq('client_id', cur.client_id as string)
              .eq('incident_type', effectiveType)
              .neq('id', id)
              .gte('occurred_at', ninetyDaysAgo.toISOString())
          : Promise.resolve({ count: 0, error: null }),
        cur.staff_profile_id
          ? adminClient
              .from('incidents')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', companyId)
              .eq('staff_profile_id', cur.staff_profile_id as string)
              .eq('incident_type', effectiveType)
              .neq('id', id)
              .gte('occurred_at', ninetyDaysAgo.toISOString())
          : Promise.resolve({ count: 0, error: null }),
      ])

      const riskResult = scoreIncident({
        severity:               (updates.severity ?? cur.severity) as string,
        incident_type:          effectiveType,
        escalation_required:    (updates.escalation_required ?? cur.escalation_required) as boolean,
        immediate_action_taken: (updates.immediate_action_taken ?? cur.immediate_action_taken) as string | null,
        repeatCountForClient:   clientRepeat.count ?? 0,
        repeatCountForWorker:   workerRepeat.count ?? 0,
      })

      updates.risk_score          = riskResult.score
      updates.risk_classification = riskResult.classification
      updates.risk_factors        = riskResult.factors
    }
  }

  // Auto-set resolved_at when status transitions to resolved/closed
  const newStatus = updates.status as string | undefined
  if (newStatus === 'resolved' || newStatus === 'closed') {
    // Fetch current to check if resolved_at is already set
    const { data: existing } = await adminClient
      .from('incidents')
      .select('resolved_at')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (existing && !existing.resolved_at) {
      updates.resolved_at = new Date().toISOString()
    }
  }

  const { data: incident, error } = await adminClient
    .from('incidents')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    console.error('[incidents/[id]] PATCH error:', error.message)
    return NextResponse.json(
      { error: 'Failed to update incident', supabase_message: error.message },
      { status: 500 },
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'incident.updated',
      entity_type: 'incident',
      entity_id:   id,
      metadata:    updates,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(incident)
}
