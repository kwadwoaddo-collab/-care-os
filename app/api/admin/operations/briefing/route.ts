import { NextResponse }  from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BriefingSection {
  heading:  string
  status:   'clear' | 'warning' | 'critical'
  items:    BriefingItem[]
  summary:  string
}

export interface BriefingItem {
  label:    string
  value:    string
  priority: 'critical' | 'urgent' | 'warning' | 'ok'
  url?:     string
}

export interface DailyBriefing {
  date:              string
  risk_headline:     'clear' | 'warning' | 'critical'
  sections:          BriefingSection[]
  open_queue_count:  number
  overdue_actions:   number
  generated_at:      string
}

// ── GET /api/admin/operations/briefing ────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const now     = new Date()
  const today   = now.toISOString().slice(0, 10)
  const next7d  = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000)
  const next30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const ago30d  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ago14d  = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    safeguardingResult,
    medicationResult,
    uncoveredResult,
    stallsResult,
    dbsResult,
    queueResult,
    overrideResult,
    highRiskIncidentsResult,
  ] = await Promise.all([
    // Unresolved safeguarding
    adminClient
      .from('incidents')
      .select('id, severity, occurred_at, clients!client_id(first_name,last_name)')
      .eq('company_id', companyId)
      .eq('incident_type', 'safeguarding')
      .in('status', ['open', 'investigating']),

    // Medication errors in last 30 days
    adminClient
      .from('incidents')
      .select('id, severity, occurred_at')
      .eq('company_id', companyId)
      .eq('incident_type', 'medication_error')
      .in('status', ['open', 'investigating'])
      .gte('occurred_at', ago30d.toISOString()),

    // Uncovered shifts next 7 days
    adminClient
      .from('shifts')
      .select('id, title, shift_date, start_time, client_name')
      .eq('company_id', companyId)
      .is('assigned_staff_id', null)
      .in('status', ['scheduled', 'confirmed'])
      .gte('shift_date', today)
      .lte('shift_date', next7d.toISOString().slice(0, 10))
      .order('shift_date', { ascending: true }),

    // Onboarding stalls >14 days
    adminClient
      .from('staff_profiles')
      .select('id, first_name, last_name, created_at')
      .eq('company_id', companyId)
      .eq('status', 'pre_employment')
      .lte('created_at', ago14d.toISOString()),

    // Expiring DBS / RTW
    adminClient
      .from('documents')
      .select('id, document_type, expiry_date, staff_profiles!staff_profile_id(first_name,last_name)')
      .eq('company_id', companyId)
      .in('document_type', ['dbs', 'right_to_work'])
      .lte('expiry_date', next30d.toISOString().slice(0, 10))
      .order('expiry_date', { ascending: true }),

    // Open queue items
    adminClient
      .from('operations_queue')
      .select('id, priority, status')
      .eq('company_id', companyId)
      .in('status', ['open', 'in_progress']),

    // Active overrides
    adminClient
      .from('compliance_overrides')
      .select('id, expires_at, staff_profiles!staff_profile_id(first_name,last_name)')
      .eq('company_id', companyId)
      .gt('expires_at', now.toISOString()),

    // High/critical incidents in last 7 days
    adminClient
      .from('incidents')
      .select('id, incident_type, severity, status, occurred_at')
      .eq('company_id', companyId)
      .in('severity', ['high', 'critical'])
      .gte('occurred_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false }),
  ])

  // ── Safeguarding section ──────────────────────────────────────────────────

  const safeguarding = (safeguardingResult.data ?? []) as unknown as Array<{
    id: string; severity: string; occurred_at: string | null;
    clients: { first_name: string; last_name: string } | null
  }>

  const safeguardingSection: BriefingSection = {
    heading: 'Safeguarding',
    status:  safeguarding.length > 0 ? (safeguarding.some((s) => s.severity === 'critical') ? 'critical' : 'warning') : 'clear',
    summary: safeguarding.length === 0
      ? 'No unresolved safeguarding incidents.'
      : `${safeguarding.length} unresolved safeguarding incident${safeguarding.length > 1 ? 's' : ''} require attention.`,
    items:   safeguarding.map((s) => ({
      label:    s.clients ? `${s.clients.first_name} ${s.clients.last_name}` : 'Unknown client',
      value:    `${s.severity} severity — ${s.occurred_at ? new Date(s.occurred_at).toLocaleDateString('en-GB') : 'date unknown'}`,
      priority: s.severity === 'critical' ? 'critical' : 'urgent',
      url:      `/admin/incidents/${s.id}`,
    })),
  }

  // ── Staffing pressure section ─────────────────────────────────────────────

  const uncovered = (uncoveredResult.data ?? []) as Array<{
    id: string; title: string; shift_date: string; start_time: string; client_name: string | null
  }>

  const staffingSection: BriefingSection = {
    heading: 'Staffing Pressure',
    status:  uncovered.length > 3 ? 'critical' : uncovered.length > 0 ? 'warning' : 'clear',
    summary: uncovered.length === 0
      ? 'All shifts in the next 7 days are covered.'
      : `${uncovered.length} uncovered shift${uncovered.length > 1 ? 's' : ''} in the next 7 days.`,
    items:   uncovered.slice(0, 8).map((s) => ({
      label:    s.title,
      value:    `${s.shift_date} at ${s.start_time.slice(0, 5)}${s.client_name ? ` — ${s.client_name}` : ''}`,
      priority: 'urgent',
      url:      `/admin/shifts`,
    })),
  }

  // ── Compliance deterioration section ─────────────────────────────────────

  const docs = (dbsResult.data ?? []) as unknown as Array<{
    id: string; document_type: string; expiry_date: string | null;
    staff_profiles: { first_name: string | null; last_name: string | null } | null
  }>

  const compItems: BriefingItem[] = docs.map((d) => {
    const daysLeft = d.expiry_date
      ? Math.ceil((new Date(d.expiry_date).getTime() - now.getTime()) / 86400000)
      : -999
    const sp = d.staff_profiles as { first_name: string | null; last_name: string | null } | null
    return {
      label:    [sp?.first_name, sp?.last_name].filter(Boolean).join(' ') || 'Unknown',
      value:    `${d.document_type.replace(/_/g, ' ').toUpperCase()} — ${daysLeft < 0 ? `expired ${Math.abs(daysLeft)}d ago` : `expires in ${daysLeft}d`}`,
      priority: daysLeft < 0 ? 'critical' : daysLeft <= 7 ? 'urgent' : 'warning',
    }
  })

  const complianceSection: BriefingSection = {
    heading: 'Compliance Deterioration',
    status:  compItems.some((i) => i.priority === 'critical') ? 'critical'
           : compItems.length > 0 ? 'warning' : 'clear',
    summary: compItems.length === 0
      ? 'No critical compliance documents expiring in the next 30 days.'
      : `${compItems.length} critical document${compItems.length > 1 ? 's' : ''} expiring or expired.`,
    items:   compItems.slice(0, 8),
  }

  // ── Onboarding bottlenecks section ────────────────────────────────────────

  const stalls = (stallsResult.data ?? []) as Array<{
    id: string; first_name: string | null; last_name: string | null; created_at: string
  }>

  const onboardingSection: BriefingSection = {
    heading: 'Onboarding Bottlenecks',
    status:  stalls.length > 5 ? 'critical' : stalls.length > 0 ? 'warning' : 'clear',
    summary: stalls.length === 0
      ? 'No onboarding stalls detected.'
      : `${stalls.length} staff member${stalls.length > 1 ? 's' : ''} stuck in pre-employment for over 14 days.`,
    items:   stalls.slice(0, 6).map((s) => {
      const days = Math.ceil((now.getTime() - new Date(s.created_at).getTime()) / 86400000)
      return {
        label:    [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unknown',
        value:    `In pre-employment for ${days} days`,
        priority: days > 30 ? 'urgent' : 'warning',
        url:      `/admin/staff/${s.id}`,
      }
    }),
  }

  // ── Risk summary section ──────────────────────────────────────────────────

  const highRisk = (highRiskIncidentsResult.data ?? []) as Array<{
    id: string; incident_type: string; severity: string; occurred_at: string | null
  }>

  const medErrors = (medicationResult.data ?? []).length

  const riskItems: BriefingItem[] = [
    ...highRisk.slice(0, 5).map((i) => ({
      label:    `${i.incident_type.replace(/_/g, ' ')}`,
      value:    `${i.severity} severity — ${i.occurred_at ? new Date(i.occurred_at).toLocaleDateString('en-GB') : 'date unknown'}`,
      priority: i.severity === 'critical' ? 'critical' as const : 'urgent' as const,
      url:      `/admin/incidents/${i.id}`,
    })),
  ]

  if (medErrors > 0) {
    riskItems.unshift({
      label:    'Medication errors (30d)',
      value:    `${medErrors} open medication error${medErrors > 1 ? 's' : ''}`,
      priority: medErrors >= 3 ? 'critical' : 'urgent',
      url:      '/admin/incidents?incident_type=medication_error',
    })
  }

  const riskSection: BriefingSection = {
    heading: 'Incident Risk Summary',
    status:  riskItems.some((i) => i.priority === 'critical') ? 'critical'
           : riskItems.length > 0 ? 'warning' : 'clear',
    summary: riskItems.length === 0
      ? 'No high-risk incidents in the last 7 days.'
      : `${highRisk.length} high/critical incident${highRisk.length > 1 ? 's' : ''} in the last 7 days.`,
    items:   riskItems,
  }

  // ── Overrides section ─────────────────────────────────────────────────────

  const overrides = (overrideResult.data ?? []) as unknown as Array<{
    id: string; expires_at: string;
    staff_profiles: { first_name: string | null; last_name: string | null } | null
  }>

  const overrideSection: BriefingSection = {
    heading: 'Active Compliance Overrides',
    status:  overrides.length > 3 ? 'warning' : 'clear',
    summary: overrides.length === 0
      ? 'No active compliance overrides.'
      : `${overrides.length} active override${overrides.length > 1 ? 's' : ''} in place.`,
    items:   overrides.slice(0, 5).map((o) => {
      const sp  = o.staff_profiles as { first_name: string | null; last_name: string | null } | null
      const exp = new Date(o.expires_at)
      const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000)
      return {
        label:    [sp?.first_name, sp?.last_name].filter(Boolean).join(' ') || 'Unknown',
        value:    `Override expires in ${days} day${days === 1 ? '' : 's'}`,
        priority: 'warning',
      }
    }),
  }

  // ── Queue summary ─────────────────────────────────────────────────────────

  const queueItems  = queueResult.data ?? []
  const openQueue   = queueItems.length
  const overdueCount = 0  // placeholder — could check due_date < now

  // ── Assemble briefing ─────────────────────────────────────────────────────

  const allSections = [
    safeguardingSection,
    riskSection,
    staffingSection,
    complianceSection,
    onboardingSection,
    overrideSection,
  ]

  const riskHeadline: 'clear' | 'warning' | 'critical' =
    allSections.some((s) => s.status === 'critical') ? 'critical'
    : allSections.some((s) => s.status === 'warning') ? 'warning'
    : 'clear'

  const briefing: DailyBriefing = {
    date:              today,
    risk_headline:     riskHeadline,
    sections:          allSections,
    open_queue_count:  openQueue,
    overdue_actions:   overdueCount,
    generated_at:      now.toISOString(),
  }

  return NextResponse.json(briefing)
}
