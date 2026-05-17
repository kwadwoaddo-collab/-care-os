import { NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'

export interface OperationalAnalytics {
  queue: {
    open:           number
    resolved_30d:   number
    avg_resolution_hours: number | null
    critical_open:  number
    backlog_over_7d: number
  }
  handover: {
    total_30d:         number
    reviewed_30d:      number
    completion_rate:   number
    avg_items_per_note: number | null
  }
  communications: {
    messages_30d:         number
    auto_generated_30d:   number
    ack_rate_pct:         number
    failed_deliveries_30d:number
  }
  visit_anomalies: {
    total_unresolved:    number
    critical_unresolved: number
    late_arrivals_30d:   number
    short_visits_30d:    number
    no_shows_30d:        number
  }
  medication: {
    records_30d:        number
    refused_30d:        number
    missed_30d:         number
    escalated_30d:      number
    escalation_rate_pct:number
  }
  timestamp: string
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const now    = new Date()
  const ago30  = new Date(now.getTime() - 30  * 86400_000).toISOString()
  const cutoff7 = new Date(now.getTime() - 7  * 86400_000).toISOString()

  const [queueRes, resolvedRes, handoverRes, commsRes, ackRes, failedRes, anomalyRes, medRes] = await Promise.all([
    adminClient.from('operations_queue').select('id, priority, status, created_at').eq('company_id', companyId).in('status', ['open','pending']),
    adminClient.from('operations_queue').select('id, created_at, updated_at').eq('company_id', companyId).eq('status', 'resolved').gte('updated_at', ago30),
    adminClient.from('handover_notes').select('id, status, flagged_items, reviewed_at, created_at').eq('company_id', companyId).gte('created_at', ago30),
    adminClient.from('operational_messages').select('id, auto_generated, status, created_at').eq('company_id', companyId).gte('created_at', ago30),
    adminClient.from('message_recipients').select('id, status').eq('company_id', companyId).in('status', ['acknowledged', 'read']).gte('created_at', ago30),
    adminClient.from('notification_logs').select('id').eq('company_id', companyId).eq('status', 'failed').gte('created_at', ago30),
    adminClient.from('visit_anomalies').select('id, anomaly_type, severity, resolved, created_at').eq('company_id', companyId).gte('created_at', ago30),
    adminClient.from('visit_medication_records').select('id, action, requires_escalation, escalated, created_at').eq('company_id', companyId).gte('created_at', ago30),
  ])

  // Queue metrics
  const openQueue    = queueRes.data ?? []
  const resolvedQ    = resolvedRes.data ?? []
  const criticalOpen = openQueue.filter(q => q.priority === 'critical').length
  const backlog7d    = openQueue.filter(q => q.created_at < cutoff7).length

  let avgResolutionHours: number | null = null
  if (resolvedQ.length > 0) {
    const totalHours = resolvedQ.reduce((sum, q) => {
      return sum + (new Date(q.updated_at as string).getTime() - new Date(q.created_at as string).getTime()) / 3_600_000
    }, 0)
    avgResolutionHours = Math.round(totalHours / resolvedQ.length)
  }

  // Handover
  const handovers = handoverRes.data ?? []
  const reviewed  = handovers.filter(h => h.status === 'reviewed' || h.reviewed_at)
  const handoverRate = handovers.length > 0 ? Math.round((reviewed.length / handovers.length) * 100) : 100
  const avgItems: number | null = handovers.length > 0
    ? Math.round(handovers.reduce((s, h) => s + ((h.flagged_items as unknown[])?.length ?? 0), 0) / handovers.length)
    : null

  // Communications
  const msgs     = commsRes.data ?? []
  const autoMsgs = msgs.filter(m => m.auto_generated)
  const totalMsgRecipients = msgs.length * 3  // rough estimate
  const acked    = ackRes.data?.length ?? 0
  const ackRate  = totalMsgRecipients > 0 ? Math.round((acked / totalMsgRecipients) * 100) : 0

  // Anomalies
  const anomalies = anomalyRes.data ?? []
  const unresolved = anomalies.filter(a => !a.resolved)
  const critAnomaly = unresolved.filter(a => a.severity === 'critical').length

  // Medication
  const meds    = medRes.data ?? []
  const refused = meds.filter(m => m.action === 'refused').length
  const missed  = meds.filter(m => m.action === 'missed').length
  const escalated = meds.filter(m => m.escalated).length
  const escRate = meds.length > 0 ? Math.round((meds.filter(m => m.requires_escalation).length / meds.length) * 100) : 0

  return NextResponse.json({
    queue: {
      open:                openQueue.length,
      resolved_30d:        resolvedQ.length,
      avg_resolution_hours: avgResolutionHours,
      critical_open:       criticalOpen,
      backlog_over_7d:     backlog7d,
    },
    handover: {
      total_30d:          handovers.length,
      reviewed_30d:       reviewed.length,
      completion_rate:    handoverRate,
      avg_items_per_note: avgItems,
    },
    communications: {
      messages_30d:          msgs.length,
      auto_generated_30d:    autoMsgs.length,
      ack_rate_pct:          ackRate,
      failed_deliveries_30d: failedRes.data?.length ?? 0,
    },
    visit_anomalies: {
      total_unresolved:    unresolved.length,
      critical_unresolved: critAnomaly,
      late_arrivals_30d:   anomalies.filter(a => a.anomaly_type === 'late_arrival').length,
      short_visits_30d:    anomalies.filter(a => a.anomaly_type === 'short_visit').length,
      no_shows_30d:        anomalies.filter(a => a.anomaly_type === 'no_show').length,
    },
    medication: {
      records_30d:         meds.length,
      refused_30d:         refused,
      missed_30d:          missed,
      escalated_30d:       escalated,
      escalation_rate_pct: escRate,
    },
    timestamp: now.toISOString(),
  } satisfies OperationalAnalytics)
}
