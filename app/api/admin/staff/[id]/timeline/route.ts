/**
 * GET /api/admin/staff/[id]/timeline
 *
 * Returns a chronological activity feed for a staff profile.
 * Sources: audit_logs (filtered by entity_id), portal_invitations.
 */

import { NextResponse }  from 'next/server'
import { adminClient }   from '@/lib/supabase/admin'
import { requireAdmin }  from '@/lib/auth/requireAdmin'

export interface TimelineEvent {
  id:        string
  timestamp: string
  label:     string
  detail?:   string
  icon:      string
  kind:      'invite' | 'document' | 'status' | 'policy' | 'reminder' | 'compliance' | 'other'
}

// Human-readable labels for audit log actions
function labelForAction(action: string, metadata: Record<string, unknown> | null): { label: string; icon: string; kind: TimelineEvent['kind'] } {
  const meta = metadata ?? {}
  const docType = (meta.document_type as string | undefined)?.replace(/_/g, ' ') ?? ''
  const status  = (meta.status        as string | undefined)?.replace(/_/g, ' ') ?? ''

  if (action === 'document.uploaded')     return { label: `Document uploaded${docType ? `: ${docType}` : ''}`,    icon: '📎', kind: 'document' }
  if (action === 'document.approved')     return { label: `Document approved${docType ? `: ${docType}` : ''}`,    icon: '✅', kind: 'document' }
  if (action === 'document.rejected')     return { label: `Document rejected${docType ? `: ${docType}` : ''}`,    icon: '❌', kind: 'document' }
  if (action === 'staff.created')         return { label: 'Staff profile created',                                 icon: '👤', kind: 'status'   }
  if (action === 'staff.status_changed')  return { label: `Status changed to ${status}`,                          icon: '🔄', kind: 'status'   }
  if (action === 'portal.invite_sent')    return { label: 'Portal invite sent',                                    icon: '📧', kind: 'invite'   }
  if (action === 'onboarding.reminder_sent') return { label: 'Onboarding reminder sent',                          icon: '📧', kind: 'reminder' }
  if (action === 'onboarding.policy_acknowledged') return { label: 'Policy acknowledged',                         icon: '✍️', kind: 'policy'   }
  if (action === 'compliance.reviewed')   return { label: `Compliance reviewed`,                                   icon: '🔍', kind: 'compliance' }
  if (action.startsWith('staff.'))        return { label: action.replace('staff.', '').replace(/_/g, ' '),        icon: '👤', kind: 'other'    }
  if (action.startsWith('document.'))     return { label: action.replace('document.', '').replace(/_/g, ' '),     icon: '📄', kind: 'document' }

  return { label: action.replace(/\./g, ' › ').replace(/_/g, ' '), icon: '📋', kind: 'other' }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  // Verify staff belongs to this company
  const { data: check } = await adminClient
    .from('staff_profiles')
    .select('id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!check) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch audit log entries for this staff profile
  const { data: auditRaw } = await adminClient
    .from('audit_logs')
    .select('id, created_at, action, actor_id, metadata')
    .eq('company_id', companyId)
    .eq('entity_id', staffProfileId)
    .order('created_at', { ascending: false })
    .limit(50)

  const auditEvents: TimelineEvent[] = (auditRaw ?? []).map((row) => {
    const r    = row as { id: string; created_at: string; action: string; actor_id: string | null; metadata: Record<string, unknown> | null }
    const info = labelForAction(r.action, r.metadata)
    return {
      id:        r.id,
      timestamp: r.created_at,
      label:     info.label,
      detail:    r.actor_id ? `by ${r.actor_id.slice(0, 8)}…` : undefined,
      icon:      info.icon,
      kind:      info.kind,
    }
  })

  // Fetch portal invitations for this staff profile (invite sent, expiry)
  const { data: invitesRaw } = await adminClient
    .from('portal_invitations')
    .select('id, created_at, expires_at, token')
    .eq('staff_profile_id', staffProfileId)
    .order('created_at', { ascending: false })
    .limit(10)

  const inviteEvents: TimelineEvent[] = (invitesRaw ?? []).map((inv) => {
    const r = inv as { id: string; created_at: string; expires_at: string }
    const expired = new Date(r.expires_at) < new Date()
    return {
      id:        `invite-${r.id}`,
      timestamp: r.created_at,
      label:     'Portal invite sent',
      detail:    expired ? `Expired ${new Date(r.expires_at).toLocaleDateString('en-GB')}` : `Expires ${new Date(r.expires_at).toLocaleDateString('en-GB')}`,
      icon:      '📧',
      kind:      'invite' as const,
    }
  })

  // Merge and sort by timestamp descending, de-dup audit events that mirror invites
  const auditInviteIds = new Set(
    auditEvents.filter((e) => e.kind === 'invite').map((e) => e.timestamp.slice(0, 16))
  )
  const dedupedInvites = inviteEvents.filter(
    (e) => !auditInviteIds.has(e.timestamp.slice(0, 16))
  )

  const all = [...auditEvents, ...dedupedInvites]
  all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ events: all.slice(0, 40) })
}
