# Care OS — Operational Simulation Audit
**Date:** 2026-05-17  
**Scope:** End-to-end workflow simulation across all operational paths  
**Method:** Static code analysis + data-flow tracing + schema validation  
**Build branch:** main

---

## Executive Summary

Care OS has a solid architectural foundation: multi-tenant isolation, RBAC middleware, audit logging, compliance scoring, and a functioning worker portal. The onboarding → compliance → staff lifecycle pipeline is largely coherent. However, this audit uncovered **3 critical production blockers**, **5 high-severity workflow gaps**, and **8 medium-severity friction points** that require resolution before the platform can be safely used by a real care company. The most severe bugs involve database constraint violations that would silently break staff status management and shift operations.

---

## 1. Recruitment Workflow Simulation

### 1.1 Applicant Applies (Magic Link)
**Status: PASS**

- Admin invites applicant via `/api/admin/applicants/invite`
- Applicant receives magic link, completes form at `/portal/apply`
- Form saves to `form_responses` + `form_answers` with full structured JSONB
- Employment history, references, gap declarations captured correctly
- Idempotency: duplicate applicant emails are blocked by `UNIQUE(company_id, email)`

**Findings:**
- `job_role` field in the application form uses slug `applying_for`, but `SLUG_TO_COLUMN` maps only `national_insurance`, `town_city`, etc. — the `applying_for` slug is not mapped to `job_role` during conversion. **This means `job_role` will be null on the staff profile after conversion unless the recruiter manually fills it.**
- No duplicate application prevention (applicant can re-apply if they receive a second invite).

### 1.2 Recruiter Reviews + Shortlists
**Status: PASS with gap**

- Status flow: `applied → shortlisted → interview_scheduled → rejected/hired`
- `PATCH /api/admin/applicants/[id]/status` correctly validates allowed transitions
- Audit log written on every status change

**Findings:**
- Status transitions have NO enforcement of order. An applicant can jump from `applied` directly to `hired` without going through interview. There is no state machine guard — this is an operational risk if a recruiter misclicks.

### 1.3 Applicant Rejected + Restored
**Status: PASS**

- Rejection stores `rejected_at`, `rejected_by`, `rejection_reason`, `rejection_notes`
- Restore route correctly clears all rejection metadata and returns to `applied` or `shortlisted`
- Restore is RBAC-gated (`applicants:update`)
- Audit log is written on restore

### 1.4 Applicant Hired + Converted to Staff
**Status: PASS with data gap**

- `POST /api/admin/applicants/[id]/convert` correctly:
  - Checks for existing staff profile (idempotency, returns 409)
  - Copies form answers using `SLUG_TO_COLUMN` mapping
  - Migrates applicant documents to staff profile
  - Writes two audit log entries
- Staff profile is created with status `pre_employment`

**Findings:**
- `job_role` is never carried over (see 1.1 above)
- `applying_for` slug exists in form FIELD_DEFS but not in `SLUG_TO_COLUMN` — the role the applicant applied for is lost on conversion
- Documents are migrated non-fatally: if the migration step fails, documents remain approvable via the lazy-backfill in the approval route (acceptable resilience)

### 1.5 Duplicate Prevention
**Status: PASS**

- `UNIQUE(company_id, email)` on applicants prevents exact-match duplicates
- Convert route's 409 check prevents double-staff-profile creation

---

## 2. Staff Lifecycle Workflow Simulation

### 2.1 Staff Active → Compliance Expires → Reminder Sent
**Status: PASS**

- Compliance engine (`calculateCompliance`) is document-driven and approval-aware
- Expiry warnings fire at 30 days (`EXPIRY_WARN_DAYS`)
- Cron at `/api/cron/compliance-reminders` sends digests with 24-hour deduplication
- Compliance state `warning → non_compliant` transition fires correctly

### 2.2 Staff Suspended
**Status: PASS with gap**

- `PATCH /api/admin/staff/[id]/status` correctly handles `suspended`
- Future shift warning returned before committing if `force` is not set
- Shift unassignment is optional (caller must pass `unassign_shifts: true`)

**Findings:**
- Suspended staff still appear on the **compliance dashboard** — the compliance/staff route only filters out `terminated` (`.not('status', 'eq', 'terminated')`). Suspended and inactive staff generate compliance reminder emails and appear in the non-compliant triage view, which creates noise.

### 2.3 Staff Inactive
**STATUS: CRITICAL BUG — PRODUCTION BLOCKER**

- `ALLOWED_STATUSES` in the status route includes `'inactive'`
- The UI shows an "Inactive" status option in `StaffStatusControl`
- **The `staff_status` enum in the database NEVER has `inactive` added** — no migration adds this value
- Setting a staff member to `inactive` will produce a PostgreSQL enum constraint violation: `invalid input value for enum staff_status: "inactive"`
- This fails silently from the admin's perspective (the route returns 500, but the error message doesn't indicate why)

**Impact:** Any admin who clicks "Inactive" to manage a suspended staff member will encounter a 500 error. No data is corrupted but the operation is impossible.

### 2.4 Staff Terminated
**Status: PASS**

- Termination requires `termination_date` and `termination_reason` (validated)
- Sets `terminated_at`, `terminated_by`, `left_at`, `exit_reason`, `exit_notes`
- Linked applicant status updated to `rejected` — acceptable as archived marker
- Audit log: `staff.terminated` action

### 2.5 Staff Archived (Terminated Status View)
**Status: PASS**

- Archived staff page correctly queries `status = 'terminated'`
- Terminated staff excluded from `GET /api/admin/staff` (active list)
- Terminated staff excluded from compliance dashboard
- Shift assignment route blocks non-active staff: `if (staff.status !== 'active') return 422`

### 2.6 Staff Restored
**Status: PARTIAL**

- No dedicated restore route for terminated staff — the admin must use the status update endpoint to set back to `pre_employment` or `active`
- This works at the API level but:
  - There is no "Restore" button in the archived staff UI (`ArchivedStaffClient.tsx` does not include a restore-to-active action for terminated staff — only permanent delete)
  - The UI has no path for a UK care company to reinstate a former employee

**Finding:** Reinstating a terminated employee is a real operational need in care (staff return after maternity leave, re-hire). There is no UI path for this.

### 2.7 Permanent Delete Attempt
**STATUS: HIGH BUG**

- Delete route correctly requires `status = 'terminated'` before allowing deletion
- **Bug:** The future-shift safety check uses `.eq('assigned_to', staffProfileId)` but the actual column name in the shifts table is `assigned_staff_id` (not `assigned_to`)
- This means the shift check always returns 0 rows, and the subsequent unassignment query also fails silently
- Any future shifts assigned to this staff member are **left dangling** with a reference to a deleted staff profile
- This could cause 404 errors or null reference errors when the shifts grid loads those shifts

---

## 3. Identity & Access Workflow Simulation

### 3.1 Worker Portal Invite
**Status: PASS with security concern**

- `POST /api/admin/staff/[id]/portal-invite` generates a 32-byte random token
- Token is SHA-256 hashed before storage (correct)
- Raw token sent in magic link URL: `/worker/login?token=<raw>`
- Token expires in 7 days

**Security concern:** The raw token appears in:
- The URL bar (visible to anyone looking over the worker's shoulder)
- Browser history
- HTTP Referer headers if the user navigates to an external link from the portal

No rate limiting on re-sends; each new invite invalidates the previous token.

**RBAC gap:** The portal invite route has NO permission check — any authenticated admin (including `coordinator` and `compliance_manager`) can send a portal invite. Only `company_admin` should be able to provision portal access.

### 3.2 Admin Role Upgrade
**Status: PASS**

- `POST /api/admin/staff/[id]/admin-access` correctly requires `canManageRoles()` (company_admin+)
- Checks for duplicate profile (`sp.profile_id` existing)
- Resend path (`isResend: true`) re-generates link for existing account
- Audit: `admin_access.created` + `admin_access.invited`

### 3.3 Admin Invite Sent
**Status: PASS**

- Uses `auth.admin.generateLink` (invite type) — correct for user-invite flow
- Creates/upserts `profiles` row with role `care_worker` (correct default)
- Links `staff_profiles.profile_id` to auth user ID
- Invite email sent via Resend

### 3.4 Password Setup + Admin Access Active
**Status: PASS**

- Auth callback at `/auth/callback` exchanges PKCE code
- Redirect to `/admin/set-password`
- `requireAdmin` validates session + fetches profile → returns `companyId` + `role`

### 3.5 Worker/Admin Unified Identity
**Status: PARTIAL — no true unification**

- A staff member with admin access has:
  - `staff_profiles.profile_id` → auth user
  - `profiles.role` → their admin role (e.g., `care_worker` → upgraded to `coordinator`)
  - `staff_profiles.portal_token_hash` → worker portal token (independent)
- These are separate auth mechanisms — the worker portal uses sessionStorage token, admin uses Supabase Auth session
- A staff member who logs into the worker portal cannot see their admin dashboard and vice versa
- There is no "switch view" mechanism

**Finding:** A care worker who has been upgraded to `coordinator` role would need to know they have two separate logins. No UI guidance exists for this.

### 3.6 RBAC Accuracy
**Status: PASS with legacy gap**

- Permission matrix in `lib/rbac/permissions.ts` is comprehensive and correct
- `normaliseRole()` handles legacy `'admin'` → `'company_admin'`
- RLS policies in migration 002 use `get_my_role() = 'admin'` — this will deny access to all new roles (`company_admin`, `registered_manager`, etc.) if they ever use the Supabase client directly
- All current server routes use `adminClient` (service role) which bypasses RLS — so this is **not a live RBAC leak**, but it is a latent risk if any code path ever uses the non-service client for writes

---

## 4. Shift Operations Workflow Simulation

### 4.1 Create Shift
**Status: PASS**

- `POST /api/admin/shifts` creates shift with company isolation
- Shift starts in `open` status (post migration 031)

### 4.2 Assign Professional
**Status: PARTIALLY BROKEN**

- `PATCH /api/admin/shifts/[id]/assign` correctly validates:
  - Compliance (`calculateCompliance` + `calculateReadiness`)
  - Availability
  - Shift overlap (±1 day window)
  - Staff must be `active`
- Direct assignment sets status to `'accepted'` ✓ (valid after migration 031)
- Broadcast offer sets status to `'offered'` ✓ (valid after migration 031)

**Bug:** The ShiftsGrid component's `STATUS_CLS` map still uses old status names (`scheduled`, `confirmed`, `no_show`). Shifts with new statuses (`open`, `accepted`, `offered`, `declined`, `in_progress`, `missed`) display with no color badge — they render as generic gray text.

### 4.3 Edit Assignment (PATCH shift status)
**STATUS: CRITICAL BUG — PRODUCTION BLOCKER**

- `PATCH /api/admin/shifts/[id]` route defines:
  ```
  const ALLOWED_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']
  ```
- Migration 031 changed the DB enum to:
  ```
  CHECK (status IN ('open', 'offered', 'accepted', 'declined', 'in_progress', 'completed', 'missed', 'cancelled'))
  ```
- The route rejects all new valid statuses (`open`, `accepted`, `offered`, etc.) with "Invalid status" 400 error
- The route allows old statuses (`scheduled`, `confirmed`, `no_show`) which would fail the DB CHECK constraint
- **Effect:** No admin can update a shift status via the UI. Marking a shift as completed is impossible through the edit endpoint.

### 4.4 Complete Shift
**Status: BLOCKED** (see 4.3)

### 4.5 Incident Raised
**Status: PASS**

- Incidents can be created from visit notes (`CreateIncidentFromNoteButton`)
- Incidents linked to `shift_id`, `client_id`, `staff_profile_id`, `visit_note_id`
- Severity, type, escalation, resolution all captured
- Company isolation enforced

**Gap:** No `/admin/shifts/[id]` detail page exists. There is no drill-down view to see a shift's assignment history, associated incident, timesheet, and visit notes together. The incident is created from visit notes but there is no reverse link shown on the shift view.

---

## 5. Compliance Workflow Simulation

### 5.1 Upload Expired DBS
**Status: PASS — Correctly flagged**

- `calculateCompliance` checks `isExpired(expiry_date)` for each required document type
- Expired DBS pushes `'dbs'` into `expiredDocuments[]`
- `complianceState` becomes `non_compliant`
- Staff cannot be activated: `POST /api/admin/staff/[id]/status` with `status: 'active'` checks `compliance.compliant` and blocks

### 5.2 Renew DBS (Admin Approves New Upload)
**Status: PASS**

- Worker uploads new document via worker portal (`/api/worker/documents/upload`)
- Admin reviews document at `/api/admin/staff/[id]/documents/[docId]/approve`
- Approval sets `reviewed_status = 'approved'`
- Compliance recalculated immediately on approval response
- For training certificates: supersede logic marks older approved cert as `'superseded'`

### 5.3 Document Approval + Rejection
**Status: PASS**

- Approval route correctly handles both `'approve'` and `'reject'` actions
- Rejection triggers in-app notification to worker
- Ownership check handles pre-conversion applicant documents (lazy backfill)

### 5.4 Upload Replacement After Rejection
**Status: PASS with UX gap**

- Worker can upload a new document of the same type
- `calculateCompliance` uses the most recently uploaded document per type
- Old rejected doc remains in the records (no deletion)

**Gap:** When a worker uploads a replacement, there is no notification to the admin that a new document is awaiting review. The admin must check the document hub manually or notice the `pending_review` warning in the activation pre-flight.

### 5.5 Compliance Recalculation Sync
**Status: PASS**

- Compliance is recalculated on-demand (not cached) from document state
- No stale compliance state can persist between document changes

**Gap:** The compliance summary route (`/api/admin/compliance/summary`) uses the `compliance_items` table (legacy), while the compliance staff dashboard (`/api/admin/compliance/staff`) uses `calculateCompliance` from document records. These two views can show different numbers for the same staff member if `compliance_items` has not been updated to match document state.

---

## 6. Mobile Workflow Simulation

### 6.1 Applicant Mobile Onboarding
**Status: PASS**

- `/portal/apply` is fully client-rendered
- Multi-section form with progressive disclosure
- Signature canvas (`react-signature-canvas`) included
- No mobile-specific layout issues in the structure (single-column form)

### 6.2 Worker Document Upload (Mobile)
**Status: PASS**

- Worker documents page is client-rendered with file input
- File validation: max 10MB, accepted types (pdf, jpg, png, doc, docx)
- Progress indication exists
- No overflow of action buttons on mobile (mobile-first layout)

### 6.3 Admin Dashboard Mobile
**Status: PARTIAL**

- Admin layout uses `StaffGrid` (card view) and `StaffMobileList` (list view) — both exist
- `ShiftsGrid` uses a `<table>` with no mobile-responsive collapse — on small screens the table overflows horizontally without the OS horizontal scroll indicator
- Compliance dashboard uses a wide filter chip row that wraps awkwardly on mobile
- `AssignShiftModal` is a full-screen overlay — works on mobile but modal width is fixed at `max-w-2xl` which is fine

---

## A. Critical Risks

| # | Risk | Location | Impact |
|---|------|----------|--------|
| CR-1 | `inactive` not in `staff_status` DB enum | `/api/admin/staff/[id]/status` | Attempting to set a staff member Inactive throws a 500 DB constraint error. Feature is completely non-functional. |
| CR-2 | Shift PATCH route uses old status names | `/api/admin/shifts/[id]/route.ts` | All shift status edits (including marking complete) fail or violate DB constraint. Shift management is broken post-migration 031. |
| CR-3 | Staff DELETE uses wrong column name `assigned_to` | `/api/admin/staff/[id]/route.ts:322` | Future shifts are never unassigned when a staff member is permanently deleted. Dangling FK references cause runtime errors on shift list pages. |

---

## B. Workflow Failures

| # | Failure | Severity |
|---|---------|----------|
| WF-1 | No restore/reinstate path in the Archived Staff UI for terminated staff | High |
| WF-2 | `applying_for` / `job_role` not mapped in `SLUG_TO_COLUMN` — job role lost on conversion | High |
| WF-3 | ShiftsGrid STATUS_CLS uses deprecated status names — new shifts show no color badge | High |
| WF-4 | No notification to admin when worker re-uploads a rejected document | Medium |
| WF-5 | No status-transition enforcement — applicant can skip interview and be directly hired | Medium |
| WF-6 | `withdrawn` status exists in `applicant_status` enum but no API endpoint can set it | Low |
| WF-7 | No `/admin/shifts/[id]` detail page — no drill-down view for assignment history, incidents, timesheets | Medium |
| WF-8 | Suspended/inactive staff appear on compliance dashboard and receive reminder emails | Medium |

---

## C. RBAC Vulnerabilities

| # | Vulnerability | Severity |
|---|--------------|----------|
| RBAC-1 | Portal invite route has no permission check — any admin role can send worker portal invites | High |
| RBAC-2 | RLS policies in migration 002 use `get_my_role() = 'admin'` — new roles denied if ever used client-side | Medium (latent) |
| RBAC-3 | `registered_manager` has `staff:delete` permission but the DELETE route additionally enforces `role !== 'company_admin'` — double guard is inconsistent with permission matrix | Low |

---

## D. Data Integrity Risks

| # | Risk | Severity |
|---|------|----------|
| DI-1 | Staff DELETE leaves future shifts with dangling `assigned_staff_id` FK (wrong column name bug) | High |
| DI-2 | Compliance summary (compliance_items table) can diverge from compliance dashboard (documents-derived) | Medium |
| DI-3 | No document deletion — incorrectly uploaded files accumulate in storage indefinitely | Low |
| DI-4 | Actor ID is `null` in all audit logs under QA bypass — development audit trail is untraceable | Low |
| DI-5 | Magic link token appears in URL → browser history, server access logs, HTTP Referer headers | Medium |
| DI-6 | Worker token stored in sessionStorage — XSS-vulnerable; cleared on tab close | Medium |

---

## E. UX Friction Points

| # | Friction | Affected Path |
|---|---------|---------------|
| UX-1 | No "Restore" button in Archived Staff view | `/admin/staff/archived` |
| UX-2 | Staff member with dual admin/worker identity has no "switch view" UI | Worker portal + admin |
| UX-3 | Shift table overflows on mobile (no responsive collapse) | `/admin/shifts` |
| UX-4 | Compliance chip filter row wraps awkwardly on small screens | `/admin/compliance` |
| UX-5 | Admin must manually check document hub for re-uploaded pending documents | `/admin/staff/[id]` |
| UX-6 | Status transitions have no labelled reason field for non-termination changes | `/admin/staff/[id]` |
| UX-7 | No success confirmation when portal invite is sent (result returned in JSON only) | `/admin/staff/[id]` |

---

## F. Production Readiness Score

| Domain | Score | Notes |
|--------|-------|-------|
| Recruitment pipeline | 8/10 | Solid, minor data mapping gap |
| Staff lifecycle | 5/10 | Inactive status bug is a blocker |
| Identity & access | 7/10 | Portal invite missing RBAC check |
| Shift operations | 4/10 | PATCH status route critically broken post-migration 031 |
| Compliance | 8/10 | Well-designed; two data source divergence risk |
| Mobile | 7/10 | Worker portal solid; admin shift table needs responsive fix |
| Audit & security | 7/10 | Good audit logging; token-in-URL is a medium concern |

**Overall Production Readiness: 6.6 / 10**

The system is close to MVP-ready for onboarding and compliance. It cannot be used in production for shift management until CR-2 is resolved.

---

## G. Recommended Next Phase

### Immediate (before any production use)

1. **Fix CR-1:** Add `inactive` to `staff_status` enum via new migration:
   ```sql
   ALTER TYPE staff_status ADD VALUE IF NOT EXISTS 'inactive';
   ```

2. **Fix CR-2:** Align shift PATCH route `ALLOWED_STATUSES` with migration 031:
   ```ts
   const ALLOWED_STATUSES = ['open', 'offered', 'accepted', 'declined', 'in_progress', 'completed', 'missed', 'cancelled'] as const
   ```
   Also update `ShiftsGrid` `STATUS_CLS` map to include all new status names.

3. **Fix CR-3:** Replace `assigned_to` with `assigned_staff_id` in the staff DELETE handler (lines 322 and 330-331 of `/app/api/admin/staff/[id]/route.ts`).

4. **Fix RBAC-1:** Add `can(role, 'staff:write')` permission check to the portal invite route.

5. **Fix WF-2:** Add `applying_for → job_role` to the `SLUG_TO_COLUMN` map in the convert route.

### Short-term (Phase 1 hardening)

6. Add a "Restore staff member" action to the Archived Staff UI.
7. Exclude `suspended` and `inactive` staff from the compliance dashboard query.
8. Add admin notification (in-app) when a worker re-uploads a rejected document.
9. Add a status-transition guard to enforce applicant stage ordering.
10. Create a `/admin/shifts/[id]` detail page.

### Medium-term (Phase 2 prep)

11. Move worker token delivery out of the URL (use POST with redirect after token consumption).
12. Add responsive collapse to the shifts table for mobile admin use.
13. Reconcile the compliance summary (compliance_items) and compliance dashboard (documents) into a single source of truth.
14. Add a "switch role view" UX for staff who have both worker and admin access.
15. Update RLS policies to recognise all RBAC roles for forward-compatibility.

---

*Audit conducted by static analysis and end-to-end flow tracing. No live data was accessed.*
