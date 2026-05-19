import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import { forbidden }                 from '@/lib/auth/responses'
import {
  orchestrate,
  buildAuditEntry,
  type OrchestrationInput,
  type PriorityStateOverride,
  type SuppressionWindow,
  type PriorityStatus,
  type AuditAction,
} from '@/lib/operations/orchestration'

// ── GET /api/admin/operations/priorities ──────────────────────────────────────
// Returns the unified priority stream for this company.

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden()
  const { companyId } = auth.ctx

  const focusMode = req.nextUrl.searchParams.get('focus') === '1'
  const now        = new Date()
  const next14d    = new Date(now.getTime() + 14 * 86400000)
  const ago90d     = new Date(now.getTime() - 90  * 86400000)
  const ago30d     = new Date(now.getTime() - 30  * 86400000)

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const [
    staffResult,
    incidentResult,
    shiftsResult,
    docsResult,
    visitAnomalyResult,
    queueResult,
    commsResult,
    statesResult,
    suppressionResult,
  ] = await Promise.all([
    // Staff with compliance issues (non-compliant, blocked, or warning)
    adminClient
      .from('staff_profiles')
      .select(`
        id, first_name, last_name, job_role, status,
        onboarding_completed, created_at, non_compliant_since,
        dbs_checked, right_to_work_checked,
        compliance_state:compliance_states(
          state, percentage, missing_documents, expired_documents,
          missing_training, expiring_soon, risk_score, has_active_override,
          updated_at
        ),
        documents:documents(
          id, document_type, file_name, expiry_date, reviewed_status,
          verification_status, training_category, created_at
        )
      `)
      .eq('company_id', companyId)
      .neq('status', 'terminated')
      .neq('status', 'archived'),

    // Open incidents (safeguarding + others)
    adminClient
      .from('incidents')
      .select(`
        id, incident_type, severity, status, occurred_at,
        escalation_required, risk_score,
        client_id, clients!client_id(first_name, last_name),
        staff_profile_id, staff_profiles!staff_profile_id(first_name, last_name)
      `)
      .eq('company_id', companyId)
      .in('status', ['open', 'investigating'])
      .gte('occurred_at', ago90d.toISOString())
      .order('occurred_at', { ascending: false }),

    // Uncovered shifts (next 14 days)
    adminClient
      .from('shifts')
      .select('id, title, shift_date, start_time, end_time, assigned_staff_id, client_name')
      .eq('company_id', companyId)
      .in('status', ['scheduled', 'confirmed'])
      .is('assigned_staff_id', null)
      .gte('shift_date', now.toISOString().slice(0, 10))
      .lte('shift_date', next14d.toISOString().slice(0, 10))
      .order('shift_date', { ascending: true }),

    // Document verification backlog
    adminClient
      .from('documents')
      .select(`
        id, document_type, file_name, created_at, reviewed_status,
        verification_status,
        staff_profile_id,
        staff_profiles!staff_profile_id(first_name, last_name)
      `)
      .eq('company_id', companyId)
      .or('reviewed_status.eq.pending,reviewed_status.eq.rejected,verification_status.eq.pending_verification,verification_status.eq.rejected'),

    // Visit anomalies (last 7 days)
    adminClient
      .from('visit_notes')
      .select(`
        id, visit_date, check_in_time, check_out_time, missed,
        late_flag, early_departure_flag, anomaly_detected, anomaly_type,
        staff_profile_id, staff_profiles!staff_profile_id(first_name, last_name),
        client_id, clients!client_id(first_name, last_name)
      `)
      .eq('company_id', companyId)
      .gte('visit_date', new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10))
      .or('missed.eq.true,late_flag.eq.true,early_departure_flag.eq.true,anomaly_detected.eq.true'),

    // Operations queue (open items)
    adminClient
      .from('operations_queue')
      .select('*')
      .eq('company_id', companyId)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50),

    // Communications with unacknowledged recipients
    adminClient
      .from('communication_messages')
      .select('id, subject, sent_at, target_type, urgency, acknowledgement_count, total_recipients')
      .eq('company_id', companyId)
      .gte('sent_at', ago30d.toISOString())
      .order('sent_at', { ascending: false })
      .limit(20),

    // Persisted priority state overrides
    adminClient
      .from('orchestration_priority_states')
      .select('priority_id, status, owner_name, owner_id, snoozed_until, acknowledged_by, acknowledged_at')
      .eq('company_id', companyId)
      .neq('status', 'dismissed'),

    // Active suppressions
    adminClient
      .from('orchestration_suppressions')
      .select('category, source_id, reason, suppress_until')
      .eq('company_id', companyId)
      .gte('suppress_until', now.toISOString()),
  ])

  // ── Build orchestration input ─────────────────────────────────────────────

  const staffRows = staffResult.data ?? []
  const incidents = incidentResult.data ?? []

  // Compliance risks from staff
  const complianceRisks: OrchestrationInput['complianceRisks'] = []
  const onboardingReadiness: OrchestrationInput['onboardingReadiness'] = []
  const wellbeingSignals: OrchestrationInput['wellbeingSignals'] = []

  for (const s of staffRows) {
    const cs = Array.isArray(s.compliance_state) ? s.compliance_state[0] : s.compliance_state
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unknown'

    if (cs && cs.state && cs.state !== 'compliant') {
      const missingDocs: string[] = Array.isArray(cs.missing_documents) ? cs.missing_documents as string[] : []
      const expiredDocs: string[] = Array.isArray(cs.expired_documents)  ? cs.expired_documents  as string[] : []
      const missingTr:   string[] = Array.isArray(cs.missing_training)   ? cs.missing_training   as string[] : []
      const expiringSoon: string[] = Array.isArray(cs.expiring_soon)     ? cs.expiring_soon      as string[] : []

      complianceRisks.push({
        staffId:          s.id as string,
        staffName:        name,
        jobRole:          s.job_role as string | null,
        complianceState:  cs.state as 'compliant' | 'warning' | 'non_compliant' | 'blocked',
        missingDocuments: missingDocs,
        expiredDocuments: expiredDocs,
        missingTraining:  missingTr,
        expiringSoon,
        riskScore:        (cs.risk_score as number) ?? 0,
        deployabilityState: s.onboarding_completed ? cs.state : 'onboarding_incomplete',
        nonCompliantSince: s.non_compliant_since as string | null,
        hasActiveOverride: cs.has_active_override as boolean ?? false,
      })
    }

    // Onboarding: staff not yet complete
    if (!s.onboarding_completed && (s.status === 'pre_employment' || s.status === 'active')) {
      const createdAt = s.created_at as string
      const daysSince = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
      onboardingReadiness.push({
        staffId:            s.id as string,
        staffName:          name,
        jobRole:            s.job_role as string | null,
        stage:              'documents_pending',
        onboardingProgress: 0,
        blockers:           ['Onboarding not yet completed'],
        daysSinceLastProgress: daysSince > 7 ? daysSince : undefined,
        createdAt,
      })
    }
  }

  // Shift gaps
  const shiftGaps: OrchestrationInput['shiftGaps'] = (shiftsResult.data ?? []).map((s) => {
    const shiftMs = new Date(s.shift_date as string).getTime()
    const daysUntil = Math.floor((shiftMs - now.getTime()) / 86400000)
    return {
      shiftId:    s.id as string,
      title:      s.title as string,
      shiftDate:  s.shift_date as string,
      startTime:  s.start_time as string,
      endTime:    s.end_time as string,
      clientName: s.client_name as string | null,
      daysUntil,
    }
  })

  // Document backlog
  const documentBacklog: OrchestrationInput['documentBacklog'] = (docsResult.data ?? [])
    .filter((d) => d.staff_profiles)
    .map((d) => {
      const sp = Array.isArray(d.staff_profiles) ? d.staff_profiles[0] : d.staff_profiles
      const staffName = sp ? [sp.first_name, sp.last_name].filter(Boolean).join(' ') : 'Unknown'
      const uploadedAt = d.created_at as string
      const daysWaiting = Math.floor((Date.now() - new Date(uploadedAt).getTime()) / 86400000)
      const status = (d.verification_status as string) || (d.reviewed_status as string) || 'pending'
      return {
        documentId:   d.id as string,
        staffId:      d.staff_profile_id as string,
        staffName,
        documentType: d.document_type as string,
        fileName:     d.file_name as string,
        uploadedAt,
        status,
        daysWaiting,
      }
    })

  // Visit anomalies
  const visitAnomalies: OrchestrationInput['visitAnomalies'] = (visitAnomalyResult.data ?? [])
    .map((v) => {
      const sp = Array.isArray(v.staff_profiles) ? v.staff_profiles[0] : v.staff_profiles
      const cl = Array.isArray(v.clients) ? v.clients[0] : v.clients
      const occurredAt = (v.visit_date as string) + 'T00:00:00Z'
      const daysAgo = Math.floor((Date.now() - new Date(occurredAt).getTime()) / 86400000)

      let anomalyType: OrchestrationInput['visitAnomalies'][0]['anomalyType'] = 'missed_visit'
      if (v.missed) anomalyType = 'missed_visit'
      else if (v.late_flag) anomalyType = 'late_start'
      else if (v.early_departure_flag) anomalyType = 'early_departure'
      else if (v.anomaly_type) anomalyType = (v.anomaly_type as OrchestrationInput['visitAnomalies'][0]['anomalyType']) ?? 'duration_anomaly'

      return {
        visitId:     v.id as string,
        anomalyType,
        staffId:     v.staff_profile_id as string | undefined,
        staffName:   sp ? [sp.first_name, sp.last_name].filter(Boolean).join(' ') : undefined,
        clientId:    v.client_id as string | undefined,
        clientName:  cl ? [cl.first_name, cl.last_name].filter(Boolean).join(' ') : undefined,
        occurredAt,
        daysAgo,
        severity:    v.missed ? 'high' : 'medium',
      }
    })

  // Incidents + safeguarding
  const incidentInputs: OrchestrationInput['incidents'] = []
  const safeguardingAlerts: OrchestrationInput['safeguardingAlerts'] = []

  for (const inc of incidents) {
    const cl = Array.isArray(inc.clients) ? inc.clients[0] : inc.clients
    const sp = Array.isArray(inc.staff_profiles) ? inc.staff_profiles[0] : inc.staff_profiles
    const clientName = cl ? [cl.first_name, cl.last_name].filter(Boolean).join(' ') : undefined
    const staffName  = sp ? [sp.first_name, sp.last_name].filter(Boolean).join(' ') : undefined
    const daysOpen   = inc.occurred_at
      ? Math.floor((Date.now() - new Date(inc.occurred_at as string).getTime()) / 86400000)
      : 0

    if (inc.incident_type === 'safeguarding') {
      safeguardingAlerts.push({
        incidentId:  inc.id as string,
        description: `${inc.incident_type} incident`,
        severity:    inc.severity as string,
        status:      inc.status as string,
        occurredAt:  inc.occurred_at as string | null,
        clientName,
        staffName,
        daysOpen,
        escalated:   inc.escalation_required as boolean ?? false,
      })
    } else {
      incidentInputs.push({
        incidentId:         inc.id as string,
        incidentType:       inc.incident_type as string,
        severity:           inc.severity as string,
        status:             inc.status as string,
        escalationRequired: inc.escalation_required as boolean ?? false,
        occurredAt:         inc.occurred_at as string | null,
        clientId:           inc.client_id as string | undefined,
        clientName,
        staffId:            inc.staff_profile_id as string | undefined,
        staffName,
        riskScore:          inc.risk_score as number | null,
        daysOpen,
      })
    }
  }

  // Communications
  const communications: OrchestrationInput['communications'] = (commsResult.data ?? [])
    .filter((c) => {
      const total = (c.total_recipients as number) ?? 0
      const acked = (c.acknowledgement_count as number) ?? 0
      return total > 0 && acked < total
    })
    .map((c) => {
      const total    = (c.total_recipients as number) ?? 0
      const acked    = (c.acknowledgement_count as number) ?? 0
      return {
        communicationId:    c.id as string,
        title:              c.subject as string,
        sentAt:             c.sent_at as string,
        targetType:         c.target_type as string,
        unacknowledgedCount: total - acked,
        urgency:            (c.urgency as 'low' | 'medium' | 'high') ?? 'low',
      }
    })

  const input: OrchestrationInput = {
    complianceRisks,
    onboardingReadiness,
    documentBacklog,
    shiftGaps,
    visitAnomalies,
    incidents:           incidentInputs,
    safeguardingAlerts,
    communications,
    wellbeingSignals,
    queueItems:          queueResult.data ?? [],
  }

  // ── State overrides ───────────────────────────────────────────────────────

  const overrides: PriorityStateOverride[] = (statesResult.data ?? []).map((s) => ({
    priorityId:      s.priority_id as string,
    status:          s.status as PriorityStatus,
    owner:           s.owner_name as string | undefined,
    ownerId:         s.owner_id as string | undefined,
    snoozedUntil:    s.snoozed_until as string | undefined,
    acknowledgedBy:  s.acknowledged_by as string | undefined,
    acknowledgedAt:  s.acknowledged_at as string | undefined,
  }))

  const suppressions: SuppressionWindow[] = (suppressionResult.data ?? []).map((s) => ({
    category:  s.category as import('@/lib/operations/orchestration').PriorityCategory | undefined,
    sourceId:  s.source_id as string | undefined,
    until:     s.suppress_until as string,
    reason:    s.reason as string,
  }))

  // ── Run orchestration ─────────────────────────────────────────────────────

  const result = orchestrate(input, overrides, suppressions, focusMode)

  return NextResponse.json(result)
}

// ── PATCH /api/admin/operations/priorities ────────────────────────────────────
// Update a priority item's state (assign, acknowledge, snooze, resolve, escalate)

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden()
  const { companyId, userId } = auth.ctx

  const body = await req.json() as {
    priorityId: string
    action:     AuditAction
    owner?:     string
    ownerId?:   string
    snoozedUntil?: string
    note?:      string
  }

  const { priorityId, action, note } = body
  if (!priorityId || !action) {
    return NextResponse.json({ error: 'priorityId and action required' }, { status: 400 })
  }

  // Resolve actor name
  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()

  const actorName = (profile?.full_name as string) ?? 'Admin'

  // Map action to status
  const statusMap: Partial<Record<AuditAction, PriorityStatus>> = {
    acknowledged: 'acknowledged',
    assigned:     'in_progress',
    snoozed:      'snoozed',
    resolved:     'resolved',
    escalated:    'escalated',
    dismissed:    'dismissed',
  }
  const newStatus = statusMap[action] ?? 'open'

  const upsertData: Record<string, unknown> = {
    company_id:  companyId,
    priority_id: priorityId,
    status:      newStatus,
  }

  if (action === 'acknowledged') {
    upsertData.acknowledged_by = userId
    upsertData.acknowledged_at = new Date().toISOString()
  }
  if (action === 'assigned' && body.owner) {
    upsertData.owner_name = body.owner
    upsertData.owner_id   = body.ownerId ?? null
  }
  if (action === 'snoozed' && body.snoozedUntil) {
    upsertData.snoozed_until = body.snoozedUntil
    upsertData.snoozed_by    = userId
    if (note) upsertData.snooze_reason = note
  }
  if (action === 'resolved') {
    upsertData.resolved_by  = userId
    upsertData.resolved_at  = new Date().toISOString()
    if (note) upsertData.resolution_note = note
  }
  if (action === 'dismissed') {
    upsertData.dismissed_by  = userId
    upsertData.dismissed_at  = new Date().toISOString()
    if (note) upsertData.dismiss_reason = note
  }

  await adminClient
    .from('orchestration_priority_states')
    .upsert(upsertData, { onConflict: 'company_id,priority_id' })

  // Write audit log
  const auditEntry = buildAuditEntry(
    priorityId,
    action,
    { id: userId, name: actorName },
    note,
    body.owner ? { owner: body.owner } : undefined,
  )

  await adminClient
    .from('orchestration_audit_log')
    .insert({
      company_id:  companyId,
      priority_id: auditEntry.priorityId,
      action:      auditEntry.action,
      actor_id:    userId,
      actor_name:  auditEntry.actorName,
      note:        auditEntry.note,
      metadata:    auditEntry.metadata,
    })

  return NextResponse.json({ ok: true })
}
