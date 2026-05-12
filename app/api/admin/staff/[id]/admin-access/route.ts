import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { canManageRoles }            from '@/lib/rbac/can'
import { normaliseRole }             from '@/lib/rbac/roles'

// ── POST /api/admin/staff/[id]/admin-access ────────────────────────────────
//
// Provisions an admin portal account for a staff member.
//
// This creates a Supabase Auth user (via inviteUserByEmail) and links it
// to the staff member's profile row. The staff member receives an invite
// email containing a link to set their password and access the admin portal.
//
// The role is set to 'care_worker' by default — the caller must then use
// PATCH /api/admin/staff/[id]/role to assign the operational role.
//
// Enforcement chain:
//  1. requireAdmin()              — session + company isolation
//  2. canManageRoles(callerRole)  — only company_admin / super_admin
//  3. Target staff in same company — tenant isolation
//  4. Staff must have email        — 400
//  5. profile_id must be null      — 409 if already linked
//  6. auth.admin.inviteUserByEmail — creates auth.users row
//  7. Insert profiles row          — links auth user to company + role
//  8. Update staff_profiles.profile_id + admin_invite_sent_at
//  9. Audit: admin_access.created + admin_access.invited

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId: actorId, role: callerRole } = auth.ctx

  // ── 2. Permission check ────────────────────────────────────────────────────
  if (!canManageRoles(callerRole)) {
    void writeAudit({
      companyId, actorId,
      action:    'admin_access.failed',
      entityId:  (await params).id,
      metadata:  { reason: 'insufficient_permission', caller_role: callerRole },
    })
    return NextResponse.json(
      { error: 'Insufficient permissions. Only company admins can create admin portal access.' },
      { status: 403 }
    )
  }

  const { id: staffProfileId } = await params

  let body: { send_email?: boolean } = {}
  try {
    body = await request.json() as { send_email?: boolean }
  } catch { /* body is optional */ }

  const sendEmail = body.send_email !== false   // default: send invite email

  // ── 3. Fetch staff profile (tenant isolation) ─────────────────────────────
  const { data: sp, error: spErr } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, email, first_name, last_name, profile_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spErr || !sp) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // ── 4. Must have email ─────────────────────────────────────────────────────
  if (!sp.email) {
    return NextResponse.json(
      { error: 'Staff profile has no email address. Add one before creating admin portal access.' },
      { status: 400 }
    )
  }

  const email = (sp.email as string).toLowerCase().trim()

  // ── 5. Must NOT already have an admin account ──────────────────────────────
  if (sp.profile_id) {
    return NextResponse.json(
      { error: 'Admin portal account already exists for this staff member.' },
      { status: 409 }
    )
  }

  // ── 6. Create Supabase Auth user ──────────────────────────────────────────
  const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        // User metadata — passed to the profiles trigger if one exists.
        // Also used by our manual profiles insert below as a fallback.
        company_id: companyId,
        role:       'care_worker',
        first_name: sp.first_name ?? '',
        last_name:  sp.last_name  ?? '',
      },
      // Redirect to the admin panel after they accept the invite
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin`,
    }
  )

  if (inviteErr || !invited?.user) {
    console.error('[admin-access] invite error:', inviteErr?.message)
    void writeAudit({
      companyId, actorId,
      action:   'admin_access.failed',
      entityId: staffProfileId,
      metadata: { reason: 'invite_failed', error: inviteErr?.message, email },
    })
    return NextResponse.json(
      { error: `Failed to create admin account: ${inviteErr?.message ?? 'Unknown error'}` },
      { status: 500 }
    )
  }

  const authUserId = invited.user.id

  // ── 7. Insert profiles row (no trigger exists; safe-upsert) ───────────────
  const { error: profileErr } = await adminClient
    .from('profiles')
    .upsert(
      {
        id:         authUserId,
        company_id: companyId,
        role:       'care_worker',
        first_name: (sp.first_name as string | null) ?? '',
        last_name:  (sp.last_name  as string | null) ?? '',
        email,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  if (profileErr) {
    // Auth user was created but profiles row failed — log and surface error.
    // Admin can retry; the invite email still went out.
    console.error('[admin-access] profiles insert error:', profileErr.message)
    void writeAudit({
      companyId, actorId,
      action:   'admin_access.failed',
      entityId: staffProfileId,
      metadata: { reason: 'profiles_insert_failed', auth_user_id: authUserId, email },
    })
    return NextResponse.json(
      { error: 'Auth user created but failed to link to company profile. Contact support.' },
      { status: 500 }
    )
  }

  // ── 8. Link profile_id on staff_profiles ──────────────────────────────────
  const now = new Date().toISOString()
  const { error: linkErr } = await adminClient
    .from('staff_profiles')
    .update({
      profile_id:           authUserId,
      ...(sendEmail ? {
        admin_invite_sent_at: now,
        admin_invite_email:   email,
      } : {}),
    })
    .eq('id', staffProfileId)
    .eq('company_id', companyId)

  if (linkErr) {
    console.error('[admin-access] profile link error:', linkErr.message)
    // Non-fatal: profile and auth user exist. Just log.
  }

  // ── 9. Audit log (fire-and-forget) ────────────────────────────────────────
  void writeAudit({
    companyId, actorId,
    action:   'admin_access.created',
    entityId: staffProfileId,
    metadata: {
      profile_id:      authUserId,
      email,
      caller_role:     callerRole,
      staff_profile_id: staffProfileId,
    },
  })

  if (sendEmail) {
    void writeAudit({
      companyId, actorId,
      action:   'admin_access.invited',
      entityId: staffProfileId,
      metadata: { profile_id: authUserId, email },
    })
  }

  return NextResponse.json({
    ok:           true,
    profile_id:   authUserId,
    email_sent:   sendEmail,
    email,
  })
}

// ── GET /api/admin/staff/[id]/admin-access ─────────────────────────────────
// Returns admin access state for a staff member (for UI polling after creation).

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
    .select('id, profile_id, admin_invite_sent_at, admin_invite_email, portal_token_hash')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!sp) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  return NextResponse.json({
    has_admin_account:    !!sp.profile_id,
    profile_id:           sp.profile_id ?? null,
    has_worker_token:     !!(sp.portal_token_hash),
    admin_invite_sent_at: sp.admin_invite_sent_at ?? null,
    admin_invite_email:   sp.admin_invite_email   ?? null,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function writeAudit(params: {
  companyId: string
  actorId:   string
  action:    string
  entityId:  string
  metadata:  Record<string, unknown>
}): Promise<void> {
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  params.companyId,
      actor_id:    params.actorId,
      action:      params.action,
      entity_type: 'staff_profile',
      entity_id:   params.entityId,
      metadata:    params.metadata,
    })
  } catch { /* audit failures must never surface */ }
}
