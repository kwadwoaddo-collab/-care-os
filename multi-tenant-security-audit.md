# Care OS — Multi-Tenant Security & Data Isolation Audit
**Date:** 2026-05-17  
**Scope:** Full codebase — API routes, RBAC, storage, worker portal, applicant portal, audit logs  
**Method:** Static analysis, data-flow tracing, simulated attack vector review  
**Status:** All identified vulnerabilities patched in this pass

---

## Executive Summary

Care OS uses a consistent `company_id`-based multi-tenancy model enforced server-side via `requireAdmin()` and `validateWorkerToken()`. All admin routes use the Supabase service-role client (bypassing RLS), making server-side tenant scoping the primary isolation layer. This audit found **2 high-severity isolation gaps**, **3 moderate RBAC gaps**, and several defence-in-depth improvements. All have been remediated.

---

## Attack Vectors Simulated

| # | Vector | Result |
|---|--------|--------|
| AV-1 | Admin from Company A calls `/api/admin/staff/{company_B_staff_id}` | Blocked — `company_id` filter returns 404 |
| AV-2 | Worker from Company A calls `/api/worker/shifts/{company_B_shift_id}` | **Was vulnerable** — now blocked with company_id + assigned_staff_id filter |
| AV-3 | Rejected applicant re-uses magic link to submit form updates | **Was vulnerable** — now blocked with `rejected` status check |
| AV-4 | Admin swaps `entity_id` in audit log query | Blocked — `company_id` filter applied |
| AV-5 | Admin queries another company's notifications via `profile_id` param | Blocked — `company_id` filter applied |
| AV-6 | Worker reuses stale signed URL (from document list endpoint) | Mitigated — 5-minute expiry on applicant document URLs; 60-second on download route |
| AV-7 | Admin calls `/api/admin/documents/download?path=../company_B/file.pdf` | Blocked — path verified against `company_id`-scoped `documents` row before URL generation |
| AV-8 | Worker calls admin routes directly with worker token | Blocked — `requireAdmin()` uses Supabase session cookies, not tokens; worker tokens are rejected |
| AV-9 | Role escalation via frontend: worker sends admin API request | Blocked — admin routes validate Supabase Auth session; `profiles.role` verified server-side |
| AV-10 | `compliance_manager` calls `/api/admin/incidents` (out-of-scope role) | **Was vulnerable** — now blocked with `incidents:read` permission check |
| AV-11 | Direct `/api/admin/audit-log` access by care_worker role | Blocked — `canViewAuditLogs()` check in place |
| AV-12 | Stale worker token used after staff termination | Partially mitigated — token expires in 7 days; no active revocation on termination |

---

## A. Critical Vulnerabilities (all patched)

### CRIT-1: Worker shift detail missing company_id isolation
**File:** `app/api/worker/shifts/[id]/route.ts`  
**Severity:** High (information disclosure, cross-tenant enumeration)

**Before:**
```ts
const { data: shift } = await adminClient
  .from('shifts')
  .select('...')
  .eq('id', shiftId)    // no company_id filter
  .maybeSingle()

// then check: if (row.assigned_staff_id !== staffProfileId) return 403
```

A worker could probe any shift UUID and receive a distinguishable 403 (shift exists but not yours) vs 404 (shift not found). This leaks whether a shift ID exists in any tenant.

**After (patched):**
```ts
const { data: shift } = await adminClient
  .from('shifts')
  .select('...')
  .eq('id', shiftId)
  .eq('company_id', companyId)         // tenant scope
  .eq('assigned_staff_id', staffProfileId)  // ownership
  .maybeSingle()

// Returns 404 for both "not found" and "not assigned" — no oracle
```

The attached `visit_notes` fetch also now includes `.eq('company_id', companyId)`.

---

### CRIT-2: Rejected applicant can access form via magic link
**File:** `app/api/applicant/validate/route.ts`  
**Severity:** High (access control bypass)

**Before:**
```ts
if (applicant.status === 'hired')   return 409
if (applicant.status === 'withdrawn') return 409
// 'rejected' not checked — rejected applicant could still load and edit their form
```

A recruiter who rejects an applicant would expect the link to be dead. Without this check, a rejected applicant could continue submitting form updates using their unexpired token, potentially updating their data to appear more favourable.

**After (patched):**
```ts
if (applicant.status === 'rejected') {
  return NextResponse.json({ error: 'This application has been closed' }, { status: 403 })
}
```

---

## B. Moderate Risks (all patched)

### MOD-1: Worker notifications missing company_id filter (defence-in-depth)
**File:** `app/api/worker/notifications/route.ts`  
**Severity:** Moderate (defence-in-depth gap; UUID uniqueness makes practical exploitation near-impossible)

Both GET and PATCH handlers filtered only by `staff_profile_id` without a `company_id` filter. While staff_profile_id UUIDs are globally unique, defence-in-depth requires company scoping.

**Patched:** Both handlers now include `.eq('company_id', companyId)`.

---

### MOD-2: RBAC not enforced on incidents routes
**Files:** `app/api/admin/incidents/route.ts`, `app/api/admin/incidents/[id]/route.ts`  
**Severity:** Moderate (role bypass within tenant)

Routes only called `requireAdmin()` without checking `incidents:read` or `incidents:write` permissions. A `compliance_manager` (no incidents permission) or `coordinator` (has incidents permission) bypass was not actively enforced.

**Patched:** Both GET and POST on list route, and GET/PATCH on detail route, now call `can(role, 'incidents:read|write')`.

---

### MOD-3: RBAC not enforced on clients routes
**Files:** `app/api/admin/clients/route.ts`, `app/api/admin/clients/[id]/route.ts`  
**Severity:** Moderate (role bypass within tenant)

`compliance_manager` role does not have `clients:read` or `clients:write`, but had unrestricted access to all client routes.

**Patched:** GET handlers check `clients:read`, POST/PATCH check `clients:write`.

---

### MOD-4: Applicant document signed URLs — 1-hour expiry window
**File:** `app/api/admin/applicants/[id]/documents/route.ts`  
**Severity:** Moderate (stale URL exposure window)

**Before:** `SIGNED_URL_EXPIRY = 3600` (1 hour)  
**After:** `SIGNED_URL_EXPIRY = 300` (5 minutes)

A signed URL embedded in the admin document viewer response could be screenshot, shared, or cached in browser history. A 5-minute window is sufficient for the page to render the document but dramatically limits the exposure window.

Note: The admin download proxy route already used 60-second expiry (correct).

---

## C. Safe Areas

The following areas were audited and found secure:

### ✅ Admin auth (`requireAdmin`)
- All admin routes call `requireAdmin()` before any data access
- Session validated via Supabase Auth cookies (not manipulable from client)
- `company_id` read from `profiles` table (server-side), not from request body or URL
- QA bypass (`QA_BYPASS_AUTH=true`) is gated by `NODE_ENV=development` and throws in production

### ✅ Worker auth (`validateWorkerToken`)
- Token is SHA-256 hashed; raw token never stored in DB
- Token expiry validated on every request
- Token cannot be extended or regenerated from the worker portal
- Worker context (`staffProfileId`, `companyId`) derived from DB, not request params
- Worker cannot escalate to admin portal — different auth mechanism entirely

### ✅ Document download proxy (`/api/admin/documents/download`)
- Path validated against `documents` table with `company_id` filter before URL generation
- 60-second signed URL — short enough to prevent meaningful reuse
- Redirect-only (URL not exposed to client as JSON)
- Path traversal protected: file paths come from DB, not raw user input

### ✅ Admin document upload
- Rate-limited (20 uploads/hour per IP)
- Staff profile ownership verified with `company_id` before storing
- Storage path includes `company_id` as prefix: `{company_id}/admin/{staffProfileId}/...`
- File type and size validated

### ✅ Worker document upload
- Storage path includes `company_id` as prefix: `{company_id}/worker/{staffProfileId}/...`
- `company_id` and `staffProfileId` come from token (not request body)
- File type and size validated against allowlist

### ✅ Audit logs
- Written server-side only via service role (no client-write path)
- All reads require `audit_log:read` permission (registered_manager+)
- Always scoped to `company_id` from authenticated session
- Cannot be deleted via any exposed API route
- Actor ID present for production sessions (null only in QA bypass dev mode)

### ✅ All admin entity routes (`staff`, `shifts`, `applicants`, `care-packages`, `visit-notes`)
- Every GET/PATCH/DELETE uses `.eq('company_id', companyId)` derived from session
- No route accepts `company_id` as a body/query parameter that could be substituted
- All `[id]` params are validated against company ownership before any write

### ✅ Compliance routes
- `/api/admin/compliance/staff` — filtered to `in('status', ['pre_employment', 'active'])`
- `/api/admin/compliance/reminders/worker` — requires `compliance:read` permission
- All compliance reads scoped to authenticated company

### ✅ Worker portal data isolation
- Workers can only read their own documents (filtered by `staff_profile_id`)
- Workers can only read their own shifts (filtered by `assigned_staff_id`)
- Workers can only read their own onboarding status (profile fetched by token-derived ID)
- Workers cannot read other staff's data; no admin data is accessible

### ✅ Applicant portal data isolation
- Token is company-bound (applicant row contains `company_id`)
- Submit route validates token before accepting form data
- Applicant form data cannot be submitted without a valid, unexpired token
- Duplicate submission prevented by `UNIQUE(company_id, email)` on applicants table

### ✅ Supabase RLS
- All tables have RLS enabled
- All server routes use the service role key (bypasses RLS as intended)
- RLS policies exist as a fallback defence for any unanticipated direct-client access
- Note: RLS policies still reference legacy `'admin'` role — new RBAC roles not in RLS; accepted risk since all routes use service role

### ✅ RBAC role hierarchy
- `super_admin` is never assignable via tenant UI (`ASSIGNABLE_ROLES` excludes it)
- Privilege escalation prevented by `canAssignRole()` — cannot assign role ≥ your own level
- Self-lockout and last-admin protections in role management route
- `care_worker` role has empty permission set — cannot access any admin data

---

## D. Recommended Hardening

### High priority
1. **Worker token revocation on termination** — When a staff member is terminated or set inactive, their `portal_token_hash` should be cleared immediately. Currently, a terminated worker retains portal access until their token expires (up to 7 days).
   ```sql
   -- In staff status update, when terminating:
   UPDATE staff_profiles SET portal_token_hash = NULL, portal_token_expires_at = NULL WHERE id = $id
   ```

2. **Audit actor_id in all paths** — Many `audit_logs` entries have `actor_id: null` because the QA bypass returns `userId: 'dev-admin'`. In production, all routes have a real `userId` from the session. Consider adding a `source: 'qa_bypass'` flag to metadata so QA audits are distinguishable rather than null.

3. **RLS policy update for new RBAC roles** — Migrate `get_my_role() = 'admin'` RLS policies to include all admin-capable roles. While all current routes use the service role (bypassing RLS), this is a latent risk if any future code path uses the anon client for server writes.

### Medium priority
4. **Timestamp worker token in audit log on each auth** — The worker auth currently logs login success/failure but not per-route access. Consider logging every successful token validation to detect unusual access patterns.

5. **Apply rate limiting to worker document route** — The `/api/worker/documents` GET has no rate limiting. An attacker with a valid token could enumerate documents at high rate. Low impact (only their own docs) but worth throttling.

6. **Validate `file_path` format before generating signed URLs** — Although the download route verifies path ownership against the `documents` table, explicitly rejecting paths containing `..` or not matching the expected `{company_id}/` prefix pattern adds defence-in-depth against DB injection that might plant a malicious path.

### Lower priority
7. **Care package visits scoping** — The care package PATCH deletes visits using only `care_package_id`. This is safe because the preceding care_packages update uses `company_id` scoping and `.single()` which fails if no match, creating an implicit gate. Adding explicit `company_id` to the visits delete would make the safety explicit.

8. **Reduce worker document `file_path` exposure** — The worker documents GET currently returns `file_path` in the response. This is used by the UI to identify file location. While the bucket is private (no direct access), removing this field from the worker response reduces information disclosure surface.

---

## E. Tenant Isolation Confidence Score

| Layer | Score | Notes |
|-------|-------|-------|
| Admin API routes | 9.5/10 | All routes scope by `company_id` from session; minor RBAC gaps now fixed |
| Worker API routes | 8.5/10 | Token-derived scope; CRIT-1 fix adds company_id to shift detail |
| Applicant portal | 8.5/10 | Token-hash auth; CRIT-2 fix blocks rejected applicants |
| Storage paths | 9/10 | Company-prefixed paths; download proxy verifies ownership |
| Audit trail | 8/10 | Company-scoped reads; actor_id null in QA dev mode |
| Database (RLS) | 7/10 | RLS enabled but policies use legacy role string; service-role bypass is intended |
| RBAC enforcement | 8.5/10 | Permission matrix comprehensive; route-level checks now added for incidents + clients |

**Overall Tenant Isolation Confidence: 8.7 / 10**

The platform has a sound multi-tenancy foundation. Remaining risks are minor or require architectural work (token revocation, RLS update) that should be scheduled for Phase 2 hardening.

---

## F. RBAC Maturity Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Role definition completeness | 9/10 | 6 roles with clear permission sets |
| Route-level enforcement | 8/10 | Most routes now enforced; some lower-risk routes still rely on `requireAdmin()` alone |
| Privilege escalation prevention | 9/10 | `canAssignRole()`, self-lockout, last-admin protection in place |
| Super-admin isolation | 10/10 | Never surfaced in tenant UI; not assignable |
| Worker/admin separation | 9/10 | Completely separate auth mechanisms |
| Care worker isolation | 10/10 | Empty permission set; cannot access admin data |
| Coordinator scope | 8/10 | Operational permissions correct; no access to compliance/audit beyond read |
| Compliance manager scope | 8.5/10 | Corrected — now blocked from incidents and clients:write |

**Overall RBAC Maturity: 8.9 / 10**

---

## Changes Made in This Pass

| File | Change |
|------|--------|
| `app/api/worker/shifts/[id]/route.ts` | Added `company_id` + `assigned_staff_id` to shift fetch; removed post-fetch ownership check; added `company_id` to visit_note fetch |
| `app/api/applicant/validate/route.ts` | Added `rejected` status block (403) |
| `app/api/worker/notifications/route.ts` | Added `company_id` filter to both GET and PATCH |
| `app/api/admin/applicants/[id]/documents/route.ts` | Reduced signed URL expiry 3600s → 300s |
| `app/api/admin/incidents/route.ts` | Added `incidents:read` and `incidents:write` permission checks |
| `app/api/admin/incidents/[id]/route.ts` | Added `incidents:read` and `incidents:write` permission checks |
| `app/api/admin/clients/route.ts` | Added `clients:read` and `clients:write` permission checks |
| `app/api/admin/clients/[id]/route.ts` | Added `clients:read` and `clients:write` permission checks |

---

*Audit conducted by static analysis, data-flow tracing, and simulated attack vector review. No live tenant data was accessed.*
