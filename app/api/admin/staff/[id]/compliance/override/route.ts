import { NextRequest, NextResponse } from 'next/server'
import { adminClient }   from '@/lib/supabase/admin'
import { requireAdmin }  from '@/lib/auth/requireAdmin'
import { can }           from '@/lib/auth/permissions'
import { forbidden }     from '@/lib/auth/responses'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComplianceOverride {
  id:              string
  reason:          string
  expiresAt:       string
  createdAt:       string
  overriddenBy:    string
  scopedItems:     string[] | null
  active:          boolean
  revokedAt:       string | null
  revokedBy:       string | null
  revokeReason:    string | null
}

// ── GET /api/admin/staff/[id]/compliance/override ─────────────────────────────
//
// Returns all overrides (active and historical) for a staff member.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id } = await params

  // Verify staff is in company
  const { data: staff } = await adminClient
    .from('staff_profiles')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

  const now = new Date().toISOString()

  const { data: overrides, error } = await adminClient
    .from('compliance_overrides')
    .select('id, reason, expires_at, created_at, overridden_by, scoped_items, revoked_at, revoked_by, revoke_reason')
    .eq('company_id', companyId)
    .eq('staff_profile_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 })
  }

  const result: ComplianceOverride[] = (overrides ?? []).map((o) => ({
    id:           o.id,
    reason:       o.reason,
    expiresAt:    o.expires_at,
    createdAt:    o.created_at,
    overriddenBy: o.overridden_by,
    scopedItems:  o.scoped_items ?? null,
    active:       !o.revoked_at && new Date(o.expires_at) > new Date(now),
    revokedAt:    o.revoked_at ?? null,
    revokedBy:    o.revoked_by ?? null,
    revokeReason: o.revoke_reason ?? null,
  }))

  const active = result.find((o) => o.active) ?? null

  return NextResponse.json({ overrides: result, activeOverride: active })
}

// ── POST /api/admin/staff/[id]/compliance/override ────────────────────────────
//
// Creates a new compliance override. Requires compliance:override permission.
//
// Body:
//   reason:       string (min 10 chars)
//   expiresAt:    ISO date string (max 30 days from now)
//   scopedItems?: string[]  (specific items to override, e.g. ['dbs', 'manual_handling'])
//
// Returns: the created override

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:override')) {
    return forbidden('Only registered managers and admins can grant compliance overrides')
  }
  const { companyId, userId } = auth.ctx

  const { id } = await params

  let body: { reason?: string; expiresAt?: string; scopedItems?: string[] }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { reason, expiresAt, scopedItems } = body

  if (!reason || reason.trim().length < 10) {
    return NextResponse.json(
      { error: 'reason must be at least 10 characters' },
      { status: 422 }
    )
  }

  if (!expiresAt) {
    return NextResponse.json({ error: 'expiresAt is required' }, { status: 422 })
  }

  const expiry = new Date(expiresAt)
  const now    = new Date()
  const max    = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  if (isNaN(expiry.getTime())) {
    return NextResponse.json({ error: 'expiresAt must be a valid ISO date' }, { status: 422 })
  }

  if (expiry <= now) {
    return NextResponse.json({ error: 'expiresAt must be in the future' }, { status: 422 })
  }

  if (expiry > max) {
    return NextResponse.json({ error: 'Override expiry cannot exceed 30 days from now' }, { status: 422 })
  }

  // Verify staff is in company
  const { data: staff } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

  // Revoke any existing active override first (one active override per staff)
  await adminClient
    .from('compliance_overrides')
    .update({ revoked_at: now.toISOString(), revoked_by: userId, revoke_reason: 'superseded by new override' })
    .eq('company_id', companyId)
    .eq('staff_profile_id', id)
    .is('revoked_at', null)
    .gt('expires_at', now.toISOString())

  // Create the new override
  const { data: created, error: createErr } = await adminClient
    .from('compliance_overrides')
    .insert({
      company_id:       companyId,
      staff_profile_id: id,
      overridden_by:    userId,
      reason:           reason.trim(),
      expires_at:       expiry.toISOString(),
      scoped_items:     scopedItems ?? null,
    })
    .select()
    .single()

  if (createErr || !created) {
    console.error('[compliance/override] insert error:', createErr?.message)
    return NextResponse.json({ error: 'Failed to create override' }, { status: 500 })
  }

  // Audit log
  await adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'compliance.override_granted',
    entity_type: 'staff_profile',
    entity_id:   id,
    metadata: {
      override_id:  created.id,
      reason:       reason.trim(),
      expires_at:   expiry.toISOString(),
      scoped_items: scopedItems ?? null,
      staff_name:   [staff.first_name, staff.last_name].filter(Boolean).join(' '),
    },
  })

  return NextResponse.json(
    {
      override: {
        id:           created.id,
        reason:       created.reason,
        expiresAt:    created.expires_at,
        createdAt:    created.created_at,
        overriddenBy: created.overridden_by,
        scopedItems:  created.scoped_items ?? null,
        active:       true,
        revokedAt:    null,
        revokedBy:    null,
        revokeReason: null,
      } satisfies ComplianceOverride,
    },
    { status: 201 }
  )
}

// ── DELETE /api/admin/staff/[id]/compliance/override ─────────────────────────
//
// Revokes the active override for a staff member.
// Body: { reason?: string }

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:override')) {
    return forbidden('Insufficient permissions to revoke compliance overrides')
  }
  const { companyId, userId } = auth.ctx

  const { id } = await params

  let body: { reason?: string } = {}
  try { body = await request.json() } catch { /* ok */ }

  const now = new Date().toISOString()

  const { data: revoked, error } = await adminClient
    .from('compliance_overrides')
    .update({
      revoked_at:   now,
      revoked_by:   userId,
      revoke_reason: body.reason ?? 'Manually revoked by administrator',
    })
    .eq('company_id', companyId)
    .eq('staff_profile_id', id)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .select()

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke override' }, { status: 500 })
  }

  if (!revoked || revoked.length === 0) {
    return NextResponse.json({ error: 'No active override found' }, { status: 404 })
  }

  // Audit log
  await adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'compliance.override_revoked',
    entity_type: 'staff_profile',
    entity_id:   id,
    metadata: {
      override_id:  revoked[0].id,
      revoke_reason: body.reason ?? 'Manually revoked',
    },
  })

  return NextResponse.json({ revoked: revoked.length })
}
