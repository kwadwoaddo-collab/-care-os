import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import { forbidden }                 from '@/lib/auth/responses'
import type { FeedEvent }            from '@/lib/operations/priorityQueue'

// ── GET /api/admin/operations/feed ────────────────────────────────────────────
// Chronological operational feed from incidents, compliance events,
// handover notes, and queue items.

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const sp    = request.nextUrl.searchParams
  const limit = Math.min(50, parseInt(sp.get('limit') ?? '30'))
  const since = sp.get('since') ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [incidentsRes, handoverRes, queueRes, auditRes] = await Promise.all([
    adminClient
      .from('incidents')
      .select('id, incident_type, severity, status, occurred_at, created_at, description, clients!client_id(first_name,last_name)')
      .eq('company_id', companyId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),

    adminClient
      .from('handover_notes')
      .select('id, author_name, summary, shift_period, handover_date, created_at')
      .eq('company_id', companyId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10),

    adminClient
      .from('operations_queue')
      .select('id, title, priority, category, status, created_at, resolved_at, resolved_by, assigned_to')
      .eq('company_id', companyId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15),

    adminClient
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, metadata, created_at')
      .eq('company_id', companyId)
      .in('action', [
        'incident.created', 'incident.updated',
        'compliance_override.created', 'compliance_override.revoked',
        'staff.status_changed', 'document.uploaded',
      ])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const events: FeedEvent[] = []

  // Incidents
  const SEV: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    critical: 'critical', high: 'high', medium: 'medium', low: 'low',
  }

  for (const inc of (incidentsRes.data ?? []) as unknown as Array<{
    id: string; incident_type: string; severity: string; status: string;
    occurred_at: string | null; created_at: string; description: string;
    clients: { first_name: string; last_name: string } | null
  }>) {
    events.push({
      id:          `inc-${inc.id}`,
      type:        inc.incident_type === 'safeguarding' ? 'safeguarding' : 'incident',
      severity:    SEV[inc.severity] ?? 'medium',
      title:       `Incident: ${inc.incident_type.replace(/_/g, ' ')}`,
      description: inc.description.slice(0, 120),
      entity_type: 'incident',
      entity_id:   inc.id,
      entity_url:  `/admin/incidents/${inc.id}`,
      occurred_at: inc.occurred_at ?? inc.created_at,
      actor:       inc.clients ? `${inc.clients.first_name} ${inc.clients.last_name}` : undefined,
    })
  }

  // Handover notes
  for (const h of (handoverRes.data ?? []) as Array<{
    id: string; author_name: string; summary: string; shift_period: string;
    handover_date: string; created_at: string
  }>) {
    events.push({
      id:          `ho-${h.id}`,
      type:        'handover',
      severity:    'info',
      title:       `Handover note — ${h.shift_period}`,
      description: h.summary.slice(0, 120),
      entity_type: 'handover',
      entity_id:   h.id,
      entity_url:  `/admin/operations/handover`,
      occurred_at: h.created_at,
      actor:       h.author_name,
    })
  }

  // Queue items
  for (const q of (queueRes.data ?? []) as Array<{
    id: string; title: string; priority: string; category: string;
    status: string; created_at: string; resolved_at: string | null;
    resolved_by: string | null; assigned_to: string | null
  }>) {
    const isResolved = q.status === 'resolved'
    events.push({
      id:          `q-${q.id}`,
      type:        'queue',
      severity:    q.priority === 'critical' ? 'critical' : q.priority === 'urgent' ? 'high' : 'medium',
      title:       isResolved ? `Resolved: ${q.title}` : `Queue item: ${q.title}`,
      description: `${q.category} · ${q.priority}${q.assigned_to ? ` · Assigned to ${q.assigned_to}` : ''}`,
      entity_type: 'queue',
      entity_id:   q.id,
      entity_url:  `/admin/operations/queue`,
      occurred_at: isResolved && q.resolved_at ? q.resolved_at : q.created_at,
      actor:       q.resolved_by ?? q.assigned_to ?? undefined,
    })
  }

  // Audit log events
  for (const a of (auditRes.data ?? []) as Array<{
    id: string; action: string; entity_type: string; entity_id: string | null;
    metadata: Record<string, unknown> | null; created_at: string
  }>) {
    if (a.action === 'compliance_override.created') {
      events.push({
        id:          `aud-${a.id}`,
        type:        'override',
        severity:    'high',
        title:       'Compliance override granted',
        description: 'A compliance block was overridden for a staff member.',
        occurred_at: a.created_at,
      })
    } else if (a.action === 'compliance_override.revoked') {
      events.push({
        id:          `aud-${a.id}`,
        type:        'override',
        severity:    'info',
        title:       'Compliance override revoked',
        description: 'A compliance override was manually revoked.',
        occurred_at: a.created_at,
      })
    }
  }

  // Sort chronologically and take the most recent
  events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  return NextResponse.json({ data: events.slice(0, limit) })
}
