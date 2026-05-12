// lib/rbac/access.ts
//
// Identity model helpers for Care OS's two-layer portal access system.
//
// ── Access Layer Architecture ─────────────────────────────────────────────────
//
//  WORKER PORTAL ACCESS
//    Gate:      staff_profiles.portal_token_hash (hashed bearer token)
//    Set by:    POST /api/admin/staff/[id]/portal-invite
//    Validated: validateWorkerToken() — token-based, no Supabase session
//    No Supabase Auth user required.
//
//  ADMIN PORTAL ACCESS
//    Gate:      staff_profiles.profile_id → profiles (linked to auth.users)
//    Set by:    POST /api/admin/staff/[id]/admin-access
//               (calls supabase.auth.admin.inviteUserByEmail → creates profiles row)
//    Validated: requireAdmin() — Supabase session cookie + profiles.role check
//
// These two layers are independent. Worker login does NOT create an admin
// account. Admin accounts must be explicitly provisioned.
//
// ── Access State Matrix ───────────────────────────────────────────────────────
//
//  portal_token_hash  |  profile_id  |  AccessState
//  -------------------|--------------|------------------
//  null               |  null        |  no_access
//  set                |  null        |  worker_only
//  null               |  set         |  admin_only
//  set                |  set         |  full_access
//
// Pure TypeScript — no server-only, importable in tests and client components.

import { normaliseRole } from './roles'

// ── Access state type ─────────────────────────────────────────────────────────

export type AccessState =
  | 'no_access'     // no token, no profile_id
  | 'worker_only'   // portal_token_hash set, no profile_id
  | 'admin_only'    // profile_id set, no portal token (uncommon)
  | 'full_access'   // both set (promoted worker)

/**
 * Determine the portal access state of a staff member from their profile data.
 * Pass only presence booleans, not the raw hash values (security).
 */
export function getAccessState(sp: {
  hasWorkerToken: boolean   // !!staff_profiles.portal_token_hash
  hasAdminAccount: boolean  // !!staff_profiles.profile_id
}): AccessState {
  const { hasWorkerToken, hasAdminAccount } = sp

  if (!hasWorkerToken && !hasAdminAccount) return 'no_access'
  if (hasWorkerToken  && !hasAdminAccount) return 'worker_only'
  if (!hasWorkerToken && hasAdminAccount)  return 'admin_only'
  return 'full_access'
}

// ── Operational role requirements ─────────────────────────────────────────────

/**
 * Returns true if a given role REQUIRES an admin portal account to be present.
 *
 * care_worker:          false — worker portal token is sufficient
 * coordinator:          true  — must be able to log into admin portal
 * compliance_manager:   true
 * registered_manager:   true
 * company_admin:        true
 * super_admin:          true  (platform only; never assigned via tenant UI)
 */
export function requiresAdminAccount(role: string): boolean {
  const normalised = normaliseRole(role)
  return normalised !== 'care_worker'
}

// ── UI messaging ──────────────────────────────────────────────────────────────

export interface AccessStateMessage {
  /** Short status label shown in the badge area */
  status: string
  /** Longer description shown below the status */
  description: string
  /** Whether to show the "Create Admin Portal Access" button */
  showCreateAdminButton: boolean
}

/**
 * Returns context-aware UI messaging based on a staff member's access state.
 * Replaces the previous generic "No portal account linked" message.
 */
export function getAccessStateMessage(state: AccessState): AccessStateMessage {
  switch (state) {
    case 'no_access':
      return {
        status:               'No portal access',
        description:          'This staff member has no portal access configured. Send a worker portal invite, or create admin portal access.',
        showCreateAdminButton: true,
      }

    case 'worker_only':
      return {
        status:               'Worker portal active',
        description:          'Worker portal access is active. To assign an operational role, create admin portal access first.',
        showCreateAdminButton: true,
      }

    case 'admin_only':
      return {
        status:               'Admin portal only',
        description:          'Admin portal access is active. No worker portal token is configured.',
        showCreateAdminButton: false,
      }

    case 'full_access':
      return {
        status:               'Full access',
        description:          'Worker and admin portal access are both active.',
        showCreateAdminButton: false,
      }
  }
}
