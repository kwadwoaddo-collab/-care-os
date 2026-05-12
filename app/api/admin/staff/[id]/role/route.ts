import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { forbidden }                 from '@/lib/auth/responses'
import {
  canManageRoles,
  canAssignRole,
} from '@/lib/rbac/can'
import {
  normaliseRole,
  ASSIGNABLE_ROLES,
  hierarchyLevel,
  type Role,
} from '@/lib/rbac/roles'
import { requiresAdminAccount }      from '@/lib/rbac/access'

// ── PATCH /api/admin/staff/[id]/role ─────────────────────────────────────────
//
// Assigns a new system role to a staff member's linked auth profile.
//
// Body: { role: string, reason?: string }
//
// Enforcement chain:
//  1. requireAdmin()        — session + company isolation
//  2. canManageRoles()      — roles:write permission
//  3. Target in same company — tenant isolation
//  4. profile_id exists     — must have admin portal account
//  5. Target profile same company — double-check
// 5b. Operational roles require admin account (redundant guard, belt-and-braces)
//  6. Role in ASSIGNABLE_ROLES — super_admin blocked
//  7. canAssignRole()       — privilege escalation guard
//  8. Self-lockout guard    — cannot demote yourself
//  9. Last-admin protection — cannot remove last company_admin
// 10. Persist + audit

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId, role: callerRole } = auth.ctx

  // ── 2. Permission check ────────────────────────────────────────────────────
  if (!canManageRoles(callerRole)) {
    void writeFailedAudit({
      companyId,
      actorId:    userId,
      entityId:   (await params).id,
      reason:     'insufficient_permission',
      callerRole,
    })
    return forbidden('Insufficient permissions: roles:write required')
  }

  const { id: staffProfileId } = await params

  let body: { role?: string; reason?: string }
  try {
    body = await request.json() as { role?: string; reason?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const requestedRoleRaw = body.role?.trim() ?? ''
  if (!requestedRoleRaw) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 })
  }

  // ── 3. Fetch target staff profile (tenant isolation) ───────────────────────
  const { data: sp, error: spErr } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, profile_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)   // tenant isolation
    .maybeSingle()

  if (spErr || !sp) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // ── 4. Must have an admin portal account ──────────────────────────────────
  if (!sp.profile_id) {
    void writeFailedAudit({
      companyId,
      actorId:    userId,
      entityId:   staffProfileId,
      reason:     'no_admin_account',
      callerRole,
    })
    return NextResponse.json(
      { error: 'This staff member has no admin portal account. Use \'Create Admin Portal Access\' first.' },
      { status: 400 }
    )
  }

  const profileId = sp.profile_id as string

  // ── 5. Fetch the linked auth profile (double tenant check) ─────────────────
  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('id, company_id, role')
    .eq('id', profileId)
    .maybeSingle()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Auth profile not found' }, { status: 404 })
  }

  // Cross-company safety: profile must belong to caller's company
  if (profile.company_id !== companyId) {
    void writeFailedAudit({
      companyId,
      actorId:    userId,
      entityId:   staffProfileId,
      reason:     'cross_company_attempt',
      callerRole,
    })
    return NextResponse.json({ error: 'Cross-company role change blocked' }, { status: 403 })
  }

  // ── 5b. Operational roles require admin account (belt-and-braces) ───────────
  //  Note: step 4 already blocks if profile_id is null, but this catches the
  //  edge case where someone calls the API with a forged profile_id that is null
  //  but role is non-care_worker. This is the semantic guard.
  const requestedRole = normaliseRole(requestedRoleRaw)

  if (requiresAdminAccount(requestedRole) && !sp.profile_id) {
    void writeFailedAudit({
      companyId,
      actorId:    userId,
      entityId:   staffProfileId,
      reason:     'operational_role_requires_admin_account',
      callerRole,
      targetRole: requestedRole,
    })
    return NextResponse.json(
      { error: `Role '${requestedRole}' requires admin portal access. Create an admin account first.` },
      { status: 409 }
    )
  }

  // ── 6. Role must be in ASSIGNABLE_ROLES (super_admin blocked) ──────────────
  if (!ASSIGNABLE_ROLES.includes(requestedRole)) {
    return NextResponse.json(
      { error: `Invalid role. Assignable roles: ${ASSIGNABLE_ROLES.join(', ')}` },
      { status: 400 }
    )
  }

  // ── 7. Privilege escalation guard ─────────────────────────────────────────
  if (!canAssignRole(callerRole, requestedRole)) {
    void writeFailedAudit({
      companyId,
      actorId:       userId,
      entityId:      staffProfileId,
      reason:        'privilege_escalation',
      callerRole,
      targetRole:    requestedRole,
    })
    return NextResponse.json(
      { error: `Your role (${callerRole}) cannot assign ${requestedRole}` },
      { status: 403 }
    )
  }

  // ── 8. Self-lockout guard ─────────────────────────────────────────────────
  if (profileId === userId) {
    return NextResponse.json(
      { error: 'You cannot change your own role' },
      { status: 409 }
    )
  }

  const previousRole = normaliseRole(profile.role as string)

  // ── 9. Last-admin protection ───────────────────────────────────────────────
  if (previousRole === 'company_admin' && requestedRole !== 'company_admin') {
    const { count } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('role', ['company_admin', 'admin'])   // include legacy 'admin' alias

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last company admin. Assign another admin first.' },
        { status: 409 }
      )
    }
  }

  // ── 10. Persist role change ────────────────────────────────────────────────
  const { error: updateErr } = await adminClient
    .from('profiles')
    .update({ role: requestedRole, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .eq('company_id', companyId)

  if (updateErr) {
    console.error('[role/patch] update error:', updateErr.message)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  // ── Audit log (fire-and-forget) ────────────────────────────────────────────
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    userId,
        action:      'role.assigned',
        entity_type: 'profile',
        entity_id:   profileId,
        metadata: {
          staff_profile_id: staffProfileId,
          from_role:        previousRole,
          to_role:          requestedRole,
          reason:           body.reason?.trim() || null,
          caller_role:      callerRole,
        },
      })
    } catch (e) {
      console.error('[role/patch] audit log error:', e)
    }
  })()

  return NextResponse.json({
    ok:            true,
    profile_id:    profileId,
    new_role:      requestedRole,
    previous_role: previousRole,
  })
}

// ── GET /api/admin/staff/[id]/role ────────────────────────────────────────────
// Returns current role + last role change audit entry for the staff member.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  const { data: sp } = await adminClient
    .from('staff_profiles')
    .select('id, profile_id, company_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!sp) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  if (!sp.profile_id) {
    return NextResponse.json({ profile_id: null, role: null, last_change: null })
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', sp.profile_id)
    .maybeSingle()

  // Fetch last role change from audit log
  const { data: lastChange } = await adminClient
    .from('audit_logs')
    .select('actor_id, metadata, created_at')
    .eq('entity_type', 'profile')
    .eq('entity_id', sp.profile_id as string)
    .eq('action', 'role.assigned')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Resolve actor display name
  let changedByName: string | null = null
  if (lastChange?.actor_id) {
    const { data: actor } = await adminClient
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', lastChange.actor_id as string)
      .maybeSingle()
    if (actor) {
      changedByName = [actor.first_name, actor.last_name].filter(Boolean).join(' ')
        || (actor.email as string | null)
    }
  }

  return NextResponse.json({
    profile_id: sp.profile_id,
    role:       profile?.role ?? null,
    last_change: lastChange
      ? {
          changed_by_name: changedByName,
          changed_at:      lastChange.created_at,
          from_role:       (lastChange.metadata as Record<string, unknown>)?.from_role ?? null,
          to_role:         (lastChange.metadata as Record<string, unknown>)?.to_role ?? null,
        }
      : null,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function writeFailedAudit(params: {
  companyId:  string
  actorId:    string
  entityId:   string
  reason:     string
  callerRole: string
  targetRole?: Role | string
}): Promise<void> {
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  params.companyId,
      actor_id:    params.actorId,
      action:      'role.change_failed',
      entity_type: 'staff_profile',
      entity_id:   params.entityId,
      metadata: {
        reason:      params.reason,
        caller_role: params.callerRole,
        target_role: params.targetRole ?? null,
      },
    })
  } catch { /* audit failures must never surface */ }
}
