import { NextResponse }  from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'
import type {
  OccSummary,
  FeedEvent,
  ShiftSummary,
  SafeguardingIncident,
  ComplianceAlert,
  QueueItem,
} from '@/lib/operations/priorityQueue'

// ── GET /api/admin/operations/summary ─────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const now       = new Date()
  const next24h   = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const next7d    = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000)
  const next30d   = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const ago14d    = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    incidentsResult,
    shiftsResult,
    onboardingResult,
    docsResult,
    overridesResult,
    queueResult,
    handoverResult,
    feedIncidentsResult,
  ] = await Promise.all([
    // Open incidents (includes safeguarding)
    adminClient
      .from('incidents')
      .select('id, incident_type, severity, status, occurred_at, description, follow_up_required, risk_score, risk_classification, client_id, staff_profile_id, clients!client_id(first_name,last_name), staff_profiles!staff_profile_id(first_name,last_name)')
      .eq('company_id', companyId)
      .in('status', ['open', 'investigating'])
      .order('occurred_at', { ascending: false }),

    // Shifts (next 7 days) — unassigned + next-24h
    adminClient
      .from('shifts')
      .select('id, title, shift_date, start_time, end_time, assigned_staff_id, client_name, status')
      .eq('company_id', companyId)
      .in('status', ['scheduled', 'confirmed'])
      .gte('shift_date', now.toISOString().slice(0, 10))
      .lte('shift_date', next7d.toISOString().slice(0, 10))
      .order('shift_date', { ascending: true }),

    // Onboarding stalls: staff stuck in pre_employment > 14 days
    adminClient
      .from('staff_profiles')
      .select('id, first_name, last_name, created_at')
      .eq('company_id', companyId)
      .eq('status', 'pre_employment')
      .lte('created_at', ago14d.toISOString()),

    // Expiring critical compliance docs (DBS / right_to_work) in next 30 days
    adminClient
      .from('documents')
      .select('id, document_type, expiry_date, staff_profile_id, staff_profiles!staff_profile_id(first_name,last_name)')
      .eq('company_id', companyId)
      .in('document_type', ['dbs', 'right_to_work'])
      .lte('expiry_date', next30d.toISOString().slice(0, 10))
      .order('expiry_date', { ascending: true }),

    // Active compliance overrides
    adminClient
      .from('compliance_overrides')
      .select('id')
      .eq('company_id', companyId)
      .gt('expires_at', now.toISOString()),

    // Priority queue (open items, top 20 by priority)
    adminClient
      .from('operations_queue')
      .select('*')
      .eq('company_id', companyId)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50),

    // Latest handover note
    adminClient
      .from('handover_notes')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Recent incidents for live feed (last 7 days)
    adminClient
      .from('incidents')
      .select('id, incident_type, severity, status, occurred_at, created_at, description, clients!client_id(first_name,last_name)')
      .eq('company_id', companyId)
      .gte('occurred_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false })
      .limit(20),
  ])

  // ── Process incidents ─────────────────────────────────────────────────────

  const openIncidents = (incidentsResult.data ?? []) as unknown as Array<{
    id: string
    incident_type: string
    severity: string
    status: string
    occurred_at: string | null
    description: string
    follow_up_required: boolean
    risk_score: number | null
    risk_classification: string | null
    client_id: string | null
    staff_profile_id: string | null
    clients: { first_name: string; last_name: string } | null
    staff_profiles: { first_name: string | null; last_name: string | null } | null
  }>

  const safeguardingAlerts = openIncidents.filter((i) => i.incident_type === 'safeguarding')
  const overdueFollowUps   = openIncidents.filter((i) => i.follow_up_required)

  const safeguardingQueue: SafeguardingIncident[] = safeguardingAlerts.map((i) => ({
    id:          i.id,
    description: i.description,
    severity:    i.severity,
    status:      i.status,
    occurred_at: i.occurred_at,
    client_name: i.clients ? `${i.clients.first_name} ${i.clients.last_name}` : null,
    staff_name:  i.staff_profiles
      ? [i.staff_profiles.first_name, i.staff_profiles.last_name].filter(Boolean).join(' ')
      : null,
    risk_score: i.risk_score,
  }))

  // ── Process shifts ────────────────────────────────────────────────────────

  const allShifts = (shiftsResult.data ?? []) as Array<{
    id: string
    title: string
    shift_date: string
    start_time: string
    end_time: string
    assigned_staff_id: string | null
    client_name: string | null
    status: string
  }>

  const uncoveredShifts = allShifts.filter((s) => !s.assigned_staff_id)
  const next24hShifts   = allShifts.filter((s) => {
    const d = new Date(s.shift_date + 'T' + s.start_time)
    return d >= now && d <= next24h
  })
  const next24hUncovered = next24hShifts.filter((s) => !s.assigned_staff_id)

  const uncoveredSummary: ShiftSummary[] = uncoveredShifts.slice(0, 10).map((s) => ({
    id:          s.id,
    title:       s.title,
    shift_date:  s.shift_date,
    start_time:  s.start_time,
    end_time:    s.end_time,
    client_name: s.client_name,
  }))

  // ── Process compliance docs ───────────────────────────────────────────────

  const docs = (docsResult.data ?? []) as unknown as Array<{
    id: string
    document_type: string
    expiry_date: string | null
    staff_profile_id: string | null
    staff_profiles: { first_name: string | null; last_name: string | null } | null
  }>

  const complianceAlerts: ComplianceAlert[] = docs
    .filter((d) => d.expiry_date && d.staff_profile_id)
    .map((d) => {
      const exp      = new Date(d.expiry_date!)
      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const staffP   = d.staff_profiles as { first_name: string | null; last_name: string | null } | null
      return {
        staff_id:    d.staff_profile_id!,
        staff_name:  staffP ? [staffP.first_name, staffP.last_name].filter(Boolean).join(' ') : 'Unknown',
        doc_type:    d.document_type,
        expiry_date: d.expiry_date!,
        days_left:   daysLeft,
        is_expired:  daysLeft < 0,
      }
    })
    .sort((a, b) => a.days_left - b.days_left)

  // ── Process priority queue ────────────────────────────────────────────────

  const queueItems = (queueResult.data ?? []) as QueueItem[]
  const critCount  = queueItems.filter((q) => q.priority === 'critical').length
  const urgCount   = queueItems.filter((q) => q.priority === 'urgent').length
  const warnCount  = queueItems.filter((q) => q.priority === 'warning').length

  // Top items: critical first, then urgent, then warning (max 10)
  const topItems = [...queueItems].sort((a, b) => {
    const prio: Record<string, number> = { critical: 4, urgent: 3, warning: 2, informational: 1 }
    return (prio[b.priority] ?? 0) - (prio[a.priority] ?? 0)
  }).slice(0, 10)

  // ── Build live feed ───────────────────────────────────────────────────────

  const feedItems: FeedEvent[] = []

  const SEV_MAP: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    critical: 'critical',
    high:     'high',
    medium:   'medium',
    low:      'low',
  }

  const recentIncidents = (feedIncidentsResult.data ?? []) as unknown as Array<{
    id: string
    incident_type: string
    severity: string
    status: string
    occurred_at: string | null
    created_at: string
    description: string
    clients: { first_name: string; last_name: string } | null
  }>

  for (const inc of recentIncidents.slice(0, 10)) {
    feedItems.push({
      id:          `inc-${inc.id}`,
      type:        inc.incident_type === 'safeguarding' ? 'safeguarding' : 'incident',
      severity:    SEV_MAP[inc.severity] ?? 'medium',
      title:       `${inc.incident_type.replace(/_/g, ' ')} — ${inc.severity}`,
      description: inc.description.slice(0, 120),
      entity_type: 'incident',
      entity_id:   inc.id,
      entity_url:  `/admin/incidents/${inc.id}`,
      occurred_at: inc.occurred_at ?? inc.created_at,
      actor:       inc.clients ? `${inc.clients.first_name} ${inc.clients.last_name}` : undefined,
    })
  }

  // Add uncovered shifts to feed
  for (const s of next24hUncovered.slice(0, 5)) {
    feedItems.push({
      id:          `shift-${s.id}`,
      type:        'staffing',
      severity:    'high',
      title:       `Uncovered shift in next 24h`,
      description: `${s.title} — ${s.shift_date} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}${s.client_name ? ` · ${s.client_name}` : ''}`,
      entity_type: 'shift',
      entity_id:   s.id,
      entity_url:  `/admin/shifts`,
      occurred_at: new Date().toISOString(),
    })
  }

  // Add compliance alerts to feed
  for (const c of complianceAlerts.filter((a) => a.is_expired || a.days_left <= 7).slice(0, 5)) {
    feedItems.push({
      id:          `doc-${c.staff_id}-${c.doc_type}`,
      type:        'compliance',
      severity:    c.is_expired ? 'critical' : 'high',
      title:       `${c.doc_type.replace(/_/g, ' ').toUpperCase()} ${c.is_expired ? 'expired' : 'expiring soon'}`,
      description: `${c.staff_name} — ${c.is_expired ? 'expired' : `expires in ${c.days_left} day${c.days_left === 1 ? '' : 's'}`}`,
      entity_type: 'staff',
      entity_id:   c.staff_id,
      entity_url:  `/admin/staff/${c.staff_id}`,
      occurred_at: new Date().toISOString(),
    })
  }

  feedItems.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  // ── Assemble summary ──────────────────────────────────────────────────────

  const summary: OccSummary = {
    open_incidents:         openIncidents.length,
    safeguarding_alerts:    safeguardingAlerts.length,
    uncovered_shifts:       uncoveredShifts.length,
    onboarding_stalls:      (onboardingResult.data ?? []).length,
    expiring_critical_docs: complianceAlerts.length,
    active_overrides:       (overridesResult.data ?? []).length,
    overdue_follow_ups:     overdueFollowUps.length,
    queue: {
      critical_count: critCount,
      urgent_count:   urgCount,
      warning_count:  warnCount,
      total_open:     queueItems.length,
      top_items:      topItems,
    },
    feed:   feedItems.slice(0, 20),
    shift_coverage: {
      total_shifts:     next24hShifts.length,
      covered:          next24hShifts.filter((s) => s.assigned_staff_id).length,
      uncovered:        next24hUncovered.length,
      uncovered_shifts: next24hUncovered.slice(0, 5).map((s) => ({
        id:          s.id,
        title:       s.title,
        shift_date:  s.shift_date,
        start_time:  s.start_time,
        end_time:    s.end_time,
        client_name: s.client_name,
      })),
    },
    safeguarding: {
      open_count: safeguardingAlerts.length,
      incidents:  safeguardingQueue.slice(0, 8),
    },
    latest_handover: handoverResult.data
      ? {
          ...(handoverResult.data as object),
          flagged_items:    (handoverResult.data as { flagged_items: unknown }).flagged_items ?? [],
          follow_up_actions: (handoverResult.data as { follow_up_actions: unknown }).follow_up_actions ?? [],
        } as import('@/lib/operations/priorityQueue').HandoverNote
      : null,
    compliance_alerts:  complianceAlerts.slice(0, 10),
    last_updated:       now.toISOString(),
  }

  return NextResponse.json(summary)
}
