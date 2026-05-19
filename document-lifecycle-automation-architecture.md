# Document Lifecycle Automation & Onboarding Intelligence

## Design Principle

`lib/onboarding/readiness.ts` is the **single source of truth** for all workforce readiness state.

It does NOT duplicate existing logic. It **coordinates** these existing engines:
- `lib/compliance/calculateCompliance.ts` — compliance percentage and state
- `lib/staff/calculateOnboardingStatus.ts` — section-by-section onboarding progress
- `lib/workforce/readinessEngine.ts` — `classifyDeployability()` 6-state classifier
- `lib/workforce/deployabilityScore.ts` — 0–100 deployability score
- `lib/staff/getRequiredDocuments.ts` — role-based required document list
- `lib/training/matrix.ts` — role-based training requirements
- `lib/documents/verification.ts` — verification eligibility

---

## Worker Readiness Stages (7 states)

Ordered from most-blocked to deployment-ready:

| Stage | Meaning |
|-------|---------|
| `blocked` | Suspended, terminated, or has rejected documents |
| `onboarding_not_started` | Profile exists but nothing completed |
| `documents_pending` | Required documents missing or expired |
| `verification_pending` | Documents uploaded, awaiting verify/approve |
| `compliance_pending` | Documents approved, compliance not passing |
| `ready_for_shadowing` | Compliance passing, needs supervised work |
| `ready_for_deployment` | Fully clear — can be assigned independently |

These stages map on top of the existing `DeployabilityState` from `classifyDeployability()`.

---

## `calculateWorkerReadiness()` — The Unified Function

**Input:**
- `staff: ReadinessStaffInput` — profile fields + onboarding fields
- `documents: ReadinessDocumentInput[]` — documents with verification_status
- `availability: ReadinessAvailabilityInput` — availability config

**Output: `WorkerReadiness`**

```typescript
{
  stage:                WorkerReadinessStage  // single authoritative stage
  deployabilityState:   string               // from classifyDeployability (backward compat)
  deployabilityScore:   number               // 0-100

  onboardingProgress:      number            // from calculateOnboardingStatus
  verificationProgress:    number            // approved docs / required docs
  compliancePercentage:    number            // from calculateCompliance

  documentGaps:        DocumentGap[]         // missing/expired/rejected/pending per type
  missingDocuments:    string[]              // from compliance engine
  expiredDocuments:    string[]              // from compliance engine
  expiringSoon:        string[]              // from compliance engine

  pendingVerificationCount: number
  rejectedCount:            number
  needsOriginalSeenCount:   number
  verificationComplete:     boolean

  expiryAlerts:        ExpiryAlert[]         // sorted by days remaining
  criticalExpiryCount: number                // expiring ≤30 days

  blockers:   string[]                       // actionable, ordered by priority
  warnings:   string[]

  isDeployable:          boolean
  isComplianceEligible:  boolean
  isShadowingReady:      boolean
}
```

---

## Expiry Scheduler (`lib/onboarding/expiryScheduler.ts`)

### Reminder cadence
`REMINDER_BANDS = [90, 60, 30, 14, 7, 1]` days before expiry.

One in-app notification per document per band. Deduplication via `document_expiry_reminders` table (unique index on `document_id × reminder_band`).

### `getDueExpiryReminders(companyId)`
Finds documents expiring within 90 days that haven't been notified for their current band. Returns `ScheduledReminder[]`.

### `markExpiredDocuments(companyId)`
Sets `verification_status = 'expired'` on all approved documents past their `expiry_date`. Run nightly by the lifecycle cron.

### `getComplianceRiskForecast(companyId, days)`
Returns count of workers + documents with compliance-critical expiries within N days. Feeds the manager pipeline and operations dashboard.

---

## Database Tables (Migration 054)

### `document_expiry_reminders`
Tracks sent reminder cadence: `(document_id, reminder_band)` unique. Prevents duplicate notifications.

### `worker_readiness_snapshots`
Cached `WorkerReadiness` state per staff member, written by the lifecycle cron. Fields:
- `readiness_stage`, `deployability_score`, `onboarding_progress`, `verification_progress`, `compliance_percentage`
- `pending_verification_count`, `rejected_count`, `critical_expiry_count`
- `is_deployable`, `is_compliance_eligible`
- `blockers`, `warnings`, `expiry_alerts` (JSONB)
- `assessed_at`

### `onboarding_lifecycle_log`
Stage transition audit trail. Records `from_stage → to_stage` with trigger source and timestamp. Enables analytics: avg onboarding duration, verification turnaround, etc.

---

## Lifecycle Automation Cron (`/api/cron/lifecycle-automation`)

Runs nightly via cron (POST, auth via `CRON_SECRET`). Per company:

1. **Mark expired documents** — calls `markExpiredDocuments()`, sets `verification_status = 'expired'`
2. **Send expiry reminders** — calls `getDueExpiryReminders()`, sends in-app notifications at 90/60/30/14/7/1-day bands
3. **Compute readiness snapshots** — calls `calculateWorkerReadiness()` for every active/pre-employment staff, upserts `worker_readiness_snapshots`
4. **Log stage transitions** — detects `from_stage → to_stage` changes, writes to `onboarding_lifecycle_log`
5. **Notify on blocking regressions** — sends admin notification if a worker's stage moves to `blocked`

---

## Admin UIs

### Onboarding & Readiness Pipeline (`/admin/onboarding/pipeline`)

- **Summary strip**: 7 cards (total, deployment ready, shadowing ready, blocked, verification pending, critical expiry, avg score)
- **Risk forecast card**: workers/documents with compliance expiry within 30 days
- **Stage kanban strip**: count per stage, clickable filter
- **Pipeline table**: name, stage badge, score chip, 3-bar progress (onboarding/verification/compliance), alerts, primary blocker, start date
- Stalled detection: staff in non-terminal stage for >14 days
- Accessible semantic table

### Readiness Panel (staff workspace, `workspace/ReadinessPanel.tsx`)

- Progress ring (score 0-100)
- Stage badge
- 3 progress bars (onboarding / verification / compliance)
- Blockers panel (red)
- Warnings panel (amber)
- Expandable: verification stats, expiry alerts, document gaps
- Refreshable via `/api/admin/onboarding/readiness?staffProfileId=X`

---

## API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/admin/onboarding/readiness` | GET | Live `WorkerReadiness` for one staff member |
| `POST /api/cron/lifecycle-automation` | POST | Nightly: mark expired, send reminders, compute snapshots |

---

## Notifications

| Trigger | Channel | Recipient |
|---------|---------|-----------|
| Document expiry ≤30d | In-app | Worker + Admin |
| Document expiry 90/60/14/7/1d | In-app | Worker |
| Worker stage → blocked | In-app | Admin |

---

## Analytics (via `onboarding_lifecycle_log`)

Query `FROM → TO` transitions to compute:
- Average onboarding duration (first seen → `ready_for_deployment`)
- Verification turnaround (documents_pending → verification_pending gap)
- Stage stall detection (time in `documents_pending` or `verification_pending`)
- Rejection rate (documents_pending → blocked transitions)
- Compliance risk trend (compliance_pending vs. deployment-ready ratio)
