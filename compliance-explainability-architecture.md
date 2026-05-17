# Compliance Explainability & Operational Transparency

**Care OS — Compliance Explainability Architecture**
_Last updated: 2026-05-17_

---

## Overview

This document describes the explainability and transparency layer built on top of the Care OS compliance engine. Every automated compliance decision — score changes, escalations, shift blocks, and overrides — is now auditable, human-readable, and operationally defensible.

**Design principle:** Every compliance output must answer "why?" — who triggered it, what rule fired, what the impact is, and what action resolves it.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Layer                                                        │
│  Admin: ComplianceExplainModal — "Why?" drill-down              │
│  Admin: Dashboard Risk Overview — top-risk + Why? buttons       │
│  Worker: ComplianceStatusPanel — block explanation + next steps │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  Explainability APIs                                             │
│                                                                  │
│  GET /api/admin/staff/[id]/compliance/explain                   │
│    → ComplianceScoreBreakdown + per-item reasons + override     │
│                                                                  │
│  GET /api/admin/staff/[id]/compliance/escalation                │
│    → escalation history + reminder log + thresholds             │
│                                                                  │
│  GET /api/admin/staff/[id]/compliance/override                  │
│  POST /api/admin/staff/[id]/compliance/override (grant)         │
│  DELETE /api/admin/staff/[id]/compliance/override (revoke)      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  Core Explainability Engine (lib/compliance/explainability.ts)  │
│                                                                  │
│  explainCompliance(summary, documents, requiredTraining)        │
│    → ComplianceScoreBreakdown                                   │
│       .issues[]     — items with problems (sorted by impact)    │
│       .ok[]         — satisfied items (audit transparency)      │
│       .penaltyPerItem — how much each issue costs (%)           │
│       .primaryBlocker — most critical single issue              │
│       .stateExplanation — plain English state reason            │
│                                                                  │
│  explainShiftBlock(state, missingDocs, expiredDocs, ...)        │
│    → ShiftBlockReason                                           │
│       .blocked      — boolean                                   │
│       .reasons      — string[] (plain English)                  │
│       .details      — per-item with override path hint          │
│       .overrideable — can a privileged user bypass this?        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Compliance Reason Breakdown

### Engine: `lib/compliance/explainability.ts`

`explainCompliance()` takes the output of `calculateCompliance()` plus the raw documents array and returns a `ComplianceScoreBreakdown`.

#### Per-Item Reasons (`ComplianceReason`)

| Field          | Description                                          |
|---------------|------------------------------------------------------|
| `item`         | Key (e.g. `dbs`, `manual_handling`)                  |
| `label`        | Human-readable name (e.g. "DBS Certificate")         |
| `category`     | `document` or `training`                             |
| `status`       | `missing`, `expired`, `expiring_soon`, or `ok`       |
| `impact`       | `critical`, `high`, `medium`, or `low`               |
| `scorePenalty` | Negative %, e.g. `-13` (zero for expiring_soon)      |
| `explanation`  | Why this matters (role-specific where relevant)      |
| `action`       | Exact step the worker or admin needs to take         |
| `expiryDate`   | ISO date if applicable                               |
| `daysUntilExpiry` | Calculated remaining days                        |

#### Score Penalty Calculation

```
penaltyPerItem = Math.round(100 / totalRequired)
```

If 8 items are required, each costs ~13%. Missing DBS + missing manual handling = −26%.

#### Impact Classification

| Category     | critical                    | high         | medium         |
|-------------|----------------------------|--------------|----------------|
| Documents   | DBS, RTW, passport         | Other missing or expired | Expiring soon |
| Training    | Safeguarding, manual handling | Other missing | Expiring soon |

---

## 2. Compliance Timeline

### `lib/staff/getComplianceTimeline.ts` (extended)

The timeline now records the following event types:

| Event Type        | Trigger                                       |
|------------------|-----------------------------------------------|
| `uploaded`        | Document uploaded                             |
| `approved`        | Document approved by admin                    |
| `rejected`        | Document rejected by admin                    |
| `superseded`      | Certificate superseded by newer upload        |
| `expired`         | Certificate expiry passed                     |
| `reminder_sent`   | Compliance reminder email sent                |
| `renewed`         | Certificate renewed                           |
| `escalated`       | Escalation level crossed (with days count)   |
| `override_granted`| Compliance override created (with reason)    |
| `override_revoked`| Compliance override revoked                  |
| `shift_blocked`   | Shift assignment blocked due to compliance   |

All events are drawn from `audit_logs` and `notification_logs`, displayed chronologically in the staff profile compliance tab.

---

## 3. Escalation Explainability

### API: `GET /api/admin/staff/[id]/compliance/escalation`

Returns:
```json
{
  "staffId": "...",
  "nonCompliantSince": "2026-05-10T...",
  "currentDays": 7,
  "thresholds": {
    "worker_notified": 0,
    "coordinator_escalated": 3,
    "manager_escalated": 7
  },
  "history": [
    {
      "id": "...",
      "timestamp": "2026-05-10T07:00:00Z",
      "level": "worker_notified",
      "levelLabel": "Worker notified",
      "daysNonCompliant": 0,
      "missingDocs": ["dbs"],
      "missingTraining": [],
      "complianceState": "non_compliant",
      "percentage": 71
    }
  ],
  "remindersLog": [...]
}
```

Escalation events are sourced from `audit_logs` with `action = 'compliance.escalation'`, written by the daily sweep cron. Each escalation record includes:
- The trigger reason (days non-compliant, missing items)
- Who was notified (admin fan-out via in_app_notifications)
- The compliance state at the time of escalation

---

## 4. Shift Blocking Explanation

### `explainShiftBlock()` — `lib/compliance/explainability.ts`

When the shift assign route (`PATCH /api/admin/shifts/[id]/assign`) rejects an assignment, it now returns:

```json
{
  "error": "Sarah cannot be assigned — compliance issues must be resolved first",
  "blockers": ["Compliance is incomplete"],
  "blockDetail": {
    "blocked": true,
    "reasons": ["DBS Certificate is missing", "Manual Handling training is missing"],
    "details": [
      {
        "item": "dbs",
        "label": "DBS Certificate",
        "status": "missing",
        "overridePath": "A compliance_manager or company_admin can grant a temporary override at /admin/staff/..."
      }
    ],
    "overrideable": true
  },
  "overrideHint": "A compliance_manager or company_admin can grant a temporary override at /admin/staff/..."
}
```

The `overridePath` field tells the assigning coordinator exactly what to do if an override is justified.

---

## 5. Admin Override System

### Database: `compliance_overrides` table (migration 043)

| Column             | Type        | Purpose                                             |
|-------------------|-------------|-----------------------------------------------------|
| `id`               | UUID        | Primary key                                         |
| `company_id`       | UUID        | Multi-tenant isolation                              |
| `staff_profile_id` | UUID        | Staff being overridden                              |
| `overridden_by`    | UUID        | Admin who granted the override                      |
| `reason`           | TEXT        | Mandatory written justification (≥10 chars)         |
| `expires_at`       | TIMESTAMPTZ | Auto-expiry (max 30 days from creation)             |
| `revoked_at`       | TIMESTAMPTZ | Set when override is cancelled early                |
| `revoked_by`       | UUID        | Admin who revoked                                   |
| `revoke_reason`    | TEXT        | Why the override was revoked                        |
| `scoped_items`     | TEXT[]      | Optional: limit to specific compliance items        |

### Constraints
- Expiry cannot exceed 30 days from creation (DB constraint)
- Only one active override per staff member (new override auto-revokes previous)
- Requires `compliance:override` permission (registered_manager, company_admin, super_admin)

### Override Flow

```
1. Admin views blocked staff → "Why?" modal
2. Admin clicks "Grant Temporary Override"
3. Writes reason (min 10 chars), sets expiry date (max 30 days)
4. POST /api/admin/staff/[id]/compliance/override
   → creates compliance_overrides row
   → logs to audit_logs (action: compliance.override_granted)
   → auto-revokes any existing active override

5. Shift assignment checks for active override:
   SELECT * FROM compliance_overrides
   WHERE staff_profile_id = ? AND revoked_at IS NULL AND expires_at > now()

6. If override found:
   → compliance block is bypassed for this assignment
   → complianceWarning = true on the response
   → logs to audit_logs (action: compliance.override_used)

7. Override expires automatically (no action needed)
   OR admin revokes early via DELETE endpoint
```

### RBAC: `compliance:override` permission

| Role               | Can grant override? |
|--------------------|:-------------------:|
| super_admin        | Yes                 |
| company_admin      | Yes                 |
| registered_manager | Yes                 |
| compliance_manager | No                  |
| coordinator        | No                  |
| care_worker        | No                  |

---

## 6. Compliance Decision Audit Trail

Every automated compliance decision is logged to `audit_logs`:

| Action                         | What logged                                                    |
|-------------------------------|----------------------------------------------------------------|
| `compliance.escalation`        | level, days_non_compliant, missing items, state, percentage   |
| `compliance.override_granted`  | override_id, reason, expires_at, scoped_items, staff_name    |
| `compliance.override_revoked`  | override_id, revoke_reason                                    |
| `compliance.override_used`     | staff_id, override_id, reason (when used in shift assign)    |
| `compliance.sweep_result`      | state, percentage, missing_docs, expired_docs (daily sweep)   |
| `compliance.worker_reminder`   | email, subject, status (in notification_logs)                 |
| `compliance.digest`            | company, sent count, item counts (in notification_logs)       |

The compliance timeline surfaces all these events in chronological order on the staff profile page.

---

## 7. Dashboard "Why?" Drill-Downs

### Risk Overview Panel

Each row in the "Highest Risk Staff" table has a **"Why?"** button. Clicking it opens the `ComplianceExplainModal` which:

1. Fetches `GET /api/admin/staff/[id]/compliance/explain`
2. Displays a score breakdown with:
   - Circular gauge (compliance %)
   - State explanation (why this state)
   - Issues list (each with penalty, explanation, and action step)
   - Satisfied items (collapsible, for audit transparency)
   - Active override banner (if override exists)
3. Provides tabs for **Score Breakdown** and **Escalation History**
4. Shows "Grant Temporary Override" form (for permitted users)

### Staff Grid Cards

Each card in the compliance grid has a **"Why? (Explain)"** option in the actions menu, opening the same modal.

---

## 8. Worker Portal Compliance Status

### `ComplianceStatusPanel` — `app/worker/documents/page.tsx`

Workers now see a compliance status panel above their document list:

| State          | Appearance                                     |
|---------------|------------------------------------------------|
| `blocked`      | Red banner — "Blocked from shifts"            |
| `non_compliant`| Orange banner — "Action required"             |
| `warning`      | Amber banner — "Credentials expiring"         |
| `compliant`    | Panel not shown                               |

The panel shows:
- **State explanation** — plain English why they are blocked
- **Compliance progress bar** — visual % indicator
- **Primary blocker** — the single most critical issue
- **Prioritised next actions** — top 3 steps to resolve issues (from `explainCompliance()`)

Example worker-facing output:
```
🚫 Blocked from shifts

All required compliance items must be satisfied before you can be deployed.
Critical training is missing or expired (2 training gaps).

Progress: ████░░░░░░  50%

Primary issue: Safeguarding

What to do next:
1. DBS Certificate — Upload your DBS certificate immediately.
   This is required before you can be assigned to shifts.
2. Safeguarding — Complete Safeguarding training and upload your certificate.
   This is mandatory for your role.
```

---

## 9. Preserved Systems

All previously built systems are preserved and integrated:

| System                    | Status     | Integration                                          |
|---------------------------|-----------|------------------------------------------------------|
| Compliance rules engine   | Preserved | `calculateCompliance()` unchanged                   |
| Role-aware training       | Preserved | Used in explain endpoint and requirements route     |
| Escalation engine         | Preserved | `escalation.ts` powers escalation history endpoint  |
| Risk scoring              | Preserved | Dashboard risk overview unchanged                   |
| Daily sweep cron          | Preserved | Still writes escalation events to audit_logs        |
| Audit logs                | Extended  | New actions: override_granted, override_used, etc.  |
| RBAC permissions          | Extended  | `compliance:override` added to registered_manager+  |
| Worker portal             | Extended  | ComplianceStatusPanel added to documents page       |

---

## Key Files

```
lib/compliance/
  explainability.ts         — reason breakdown + shift block explanation

app/api/admin/staff/[id]/compliance/
  explain/route.ts          — GET per-staff compliance reason breakdown
  escalation/route.ts       — GET escalation history + reminder log
  override/route.ts         — GET/POST/DELETE compliance overrides

components/admin/
  ComplianceExplainModal.tsx — "Why?" drill-down modal with override form

app/admin/compliance/
  ComplianceDashboardClient.tsx — updated with Why? button + modal

app/worker/documents/
  page.tsx                  — updated with ComplianceStatusPanel

lib/staff/
  getComplianceTimeline.ts  — extended with escalation/override events

app/api/worker/onboarding/requirements/route.ts
                            — extended with complianceState, nextActions

lib/rbac/permissions.ts     — compliance:override permission added

supabase/migrations/
  043_compliance_overrides.sql — compliance_overrides table
```
