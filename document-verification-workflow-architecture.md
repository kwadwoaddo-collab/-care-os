# Document Verification & Compliance Approval Workflow

## Overview

The Care OS verification workflow separates document upload from compliance eligibility. A document must pass through explicit verification and approval steps before it can satisfy compliance requirements, block onboarding gates, or affect a worker's deployability score.

---

## Lifecycle States

```
pending_verification  → Default on every upload
verified              → Identity/authenticity confirmed, not yet compliance-approved
approved              → Compliance-eligible; satisfies compliance engine requirements
rejected              → Rejected; worker notification sent
expired               → Expired after approval; compliance recalculated
superseded            → Replaced by a newer version
```

### Key separation

| State | Compliance engine counts it? | Worker can see it? |
|-------|-----------------------------|--------------------|
| pending_verification | No | Yes |
| verified | No | Yes |
| approved | Yes | Yes |
| rejected | No | Yes (with reason) |
| expired | No | Yes |
| superseded | No | No (archived) |

---

## Database Changes (Migration 053)

### New columns on `documents`

| Column | Type | Purpose |
|--------|------|---------|
| `verification_status` | `document_verification_status` enum | Primary compliance gate |
| `verified_by` | text | Who verified the document |
| `verified_at` | timestamptz | When verified |
| `verification_method` | `document_verification_method` enum | How it was verified |
| `original_seen` | boolean | Whether the physical original was seen |
| `original_seen_method` | text | in_person / video_call / certified_copy / digital |
| `original_seen_at` | timestamptz | When the original was seen |
| `original_seen_by` | text | Who confirmed original |
| `verification_notes` | text | Internal notes |
| `rejected_reason` | text | Reason for rejection (shown to worker) |
| `resubmission_requested` | boolean | Worker must upload a new document |
| `resubmission_requested_at` | timestamptz | When resubmission was requested |
| `approved_by` | text | Who approved |
| `approved_at` | timestamptz | When approved |

### New table: `document_resubmission_requests`

Tracks open resubmission tasks per staff member. Status: `pending` / `fulfilled` / `cancelled`.

---

## Verification Methods

```
original_seen       — Physical or video-verified original document
certified_copy      — Certified copy accepted
digital_check       — Online verification tool (e.g. DWP/HMRC portal)
dbs_update_service  — DBS Update Service check
sponsor_check       — Sponsor compliance check
internal_review     — Internal admin review only
```

---

## Original Seen Workflow

Identity-critical document types that require original_seen confirmation before approval:
- passport
- brp (Biometric Residence Permit)
- visa
- right_to_work
- share_code / share_code_confirmation
- id

The verification drawer shows a highlighted "Original document seen" checkbox with method selection when these types are processed. Approving without original_seen shows a warning (non-blocking for flexibility but visible in the UI).

---

## Compliance Engine Integration

`lib/compliance/calculateCompliance.ts` uses the `isDocApproved()` helper:

```typescript
function isDocApproved(d: ComplianceDocument): boolean {
  if (d.verification_status != null) return d.verification_status === 'approved'
  return d.reviewed_status === 'approved'  // legacy fallback
}
```

This means:
- All existing approved documents (from before this feature) remain compliant via the legacy fallback
- New uploads start as `pending_verification` and are not compliance-eligible until approved
- The worker portal's requirements API (`/api/worker/onboarding/requirements`) also uses this engine

---

## Verification Workflow Engine (`lib/documents/verification.ts`)

### `verifyDocument()`
Marks a document as `verified`. Sets `verified_by`, `verified_at`, `verification_method`, and optionally `original_seen` data.

### `approveDocument()`
Marks as `approved`. Syncs `reviewed_status = 'approved'` for backward compatibility. Notifies worker.

### `rejectDocument()`
Marks as `rejected`. Sets `rejected_reason`. Notifies worker via in-app notification.

### `requestResubmission()`
Marks as `rejected` + sets `resubmission_requested = true`. Creates a `document_resubmission_requests` record. Notifies worker with "resubmission required" message.

### `getVerificationQueue()`
Returns all non-archived, non-superseded documents for a company, with staff name/role joined from `staff_profiles`. Includes diagnostics counts.

---

## Verification Queue UI

`/admin/documents/verification`

### Features
- **Diagnostics strip**: total / pending / verified / approved / rejected / resubmission / needs-original
- **Status tabs**: filter by lifecycle state
- **Search**: by filename, staff name, or document type
- **Folder filter**: filter by document folder
- **Type filter**: filter by document_type
- **Per-row actions**: Verify, Approve, Reject, Resubmit buttons
- **Pending alert**: banner when documents await verification

### Verification Drawer (`VerificationDrawer.tsx`)

Slide-in panel with mode-specific forms:

| Mode | Form content |
|------|-------------|
| `verify` | Method selector, original_seen toggle + method, notes |
| `approve` | Notes, original-required warning for identity docs |
| `reject` | Preset rejection reasons, free-text reason |
| `resubmission` | Preset reasons + worker notification explanation |

---

## Worker Portal (`/worker/documents`)

Workers see:
- `VerificationStatusBadge` — shows `pending`, `verified`, `approved`, `rejected`, `resubmission required`
- Rejection reason displayed when status = rejected
- **"Upload replacement"** button visible when `resubmission_requested = true`
- API enforces `worker_visible = TRUE` — workers never see confidential documents

---

## Notification Events

| Event | Trigger | Recipient |
|-------|---------|-----------|
| Document rejected (worker) | `rejectDocument()` or `requestResubmission()` | Worker |
| Document approved (worker) | `approveDocument()` | Worker |
| Resubmission required | `requestResubmission()` | Worker |

Admin notifications for verification backlog are surfaced via the `/admin/documents/verification` diagnostics strip.

---

## Audit Trail

All verification events are logged to `document_audit_log`:

| Event | Trigger |
|-------|---------|
| `routed` | verifyDocument() — repurposed for verify action |
| `approved` | approveDocument() |
| `rejected` | rejectDocument() or requestResubmission() |

---

## API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/documents/verify` | POST | Mark as verified (identity check done) |
| `/api/admin/documents/approve` | POST | Approve (compliance-satisfying) |
| `/api/admin/documents/reject` | POST | Reject with reason |
| `/api/admin/documents/request-resubmission` | POST | Request worker to resubmit |
| `/api/admin/documents/verification-queue` | GET | Full queue + diagnostics |

---

## Operational Intelligence Integration

The `getVerificationQueue()` diagnostics feed into:
- Onboarding bottleneck detection (pending_verification count)
- Operational readiness (approved count per staff member)
- Risk scoring (non-approved identity documents raise risk score)
- Operations dashboard (verification backlog card)

The `diagnostics.requiresOriginalSeen` count specifically tracks identity documents that have been uploaded but whose physical original has not been confirmed — a CQC audit risk.
