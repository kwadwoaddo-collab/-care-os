# Compliance Automation Architecture

**Care OS — Smart Compliance & Expiry Automation**
_Last updated: 2026-05-17_

---

## Overview

Care OS compliance automation turns a passive document repository into a proactive operational compliance system. It automatically monitors, scores, and escalates compliance risks across all staff records.

The system operates at two levels:

1. **Per-staff compliance** — each staff member has a computed compliance state, risk score, and escalation level derived from their uploaded documents and training certificates.
2. **Org-wide compliance** — an aggregate health score and risk breakdown across the entire company, visible on the compliance dashboard.

---

## Architecture Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  Scheduled Jobs (Vercel Cron)                                     │
│  06:00 UTC  /api/cron/compliance-sweep    (sweep + escalate)      │
│  07:00 UTC  /api/cron/compliance-reminders (email digest)         │
└──────────────────────┬───────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│  Compliance Engine (lib/compliance/)                              │
│                                                                   │
│  calculateCompliance(docs, jobRole)  — core calculator            │
│  buildComplianceSnapshot(docs, jobRole) — snapshot builder        │
│  expiryBands.ts   — 7d/14d/30d band logic                        │
│  requirements.ts  — required docs (passport, RTW, DBS)           │
│  escalation.ts    — escalation tiers (0→3→7 days)                │
│  riskScore.ts     — per-staff + org risk scoring (0-100)          │
└──────────────────────┬───────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│  Training Matrix (lib/training/matrix.ts)                         │
│                                                                   │
│  Role-specific required training categories per job_role:         │
│  care_worker          → 5 base categories                         │
│  senior_care_worker   → +medication                               │
│  nurse                → +medication                               │
│  medication_care_worker → +medication                             │
│  team_leader          → +medication, +fire_safety                 │
│  (fallback)           → DEFAULT_CARE_TRAINING (5 base)            │
└──────────────────────┬───────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────────┐
│  Admin APIs (app/api/admin/compliance/)                           │
│                                                                   │
│  GET  /staff          — per-staff compliance rows + summary       │
│  GET  /alerts         — expired + expiring alerts                 │
│  GET  /risk-score     — org health score + top 8 at-risk staff    │
│  GET  /summary        — compliance_items aggregate counts         │
│  GET  /timeline       — per-staff compliance event history        │
│  GET  /export         — CSV export                                │
│  POST /bulk           — bulk send reminders                       │
│  POST /reminders/worker — send per-worker reminder emails         │
│  POST /reminders/send   — send digest email                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Compliance Rules Engine

### Required Documents (all roles)

| Document Type  | Mandatory |
|---------------|-----------|
| passport      | Yes       |
| right_to_work | Yes       |
| dbs           | Yes       |

Source: `lib/compliance/requirements.ts` → `REQUIRED_DOCUMENTS`

### Required Training (role-specific)

| Category              | care_worker | senior / nurse / medication | team_leader |
|-----------------------|:-----------:|:---------------------------:|:-----------:|
| manual_handling       | ✓           | ✓                           | ✓           |
| safeguarding          | ✓           | ✓                           | ✓           |
| basic_life_support    | ✓           | ✓                           | ✓           |
| infection_control     | ✓           | ✓                           | ✓           |
| health_safety         | ✓           | ✓                           | ✓           |
| medication            |             | ✓                           | ✓           |
| fire_safety           |             |                             | ✓           |

Source: `lib/training/matrix.ts` → `ROLE_TRAINING_MATRIX`

Training is resolved from `documents` rows where:
- `document_type = 'training_certificate'`
- `reviewed_status = 'approved'`
- `training_category` matches the required category
- `expiry_date` is null (perpetual) or in the future

---

## Compliance States

| State         | Meaning                                                   |
|---------------|-----------------------------------------------------------|
| `compliant`   | All required items satisfied, nothing expiring ≤30d       |
| `warning`     | All satisfied, but ≥1 item expires within 30 days         |
| `non_compliant` | ≥1 required document missing or expired                |
| `blocked`     | Non-compliant AND training gap — activation is blocked    |

The `blocked` state triggers the onboarding hard gate and prevents shift assignment.

---

## Expiry Bands

| Band       | Threshold        | Action                          |
|-----------|------------------|---------------------------------|
| `expired`  | Past expiry date | Immediately non-compliant       |
| `critical` | ≤ 7 days         | Urgent worker notification      |
| `warning`  | ≤ 14 days        | Admin alert                     |
| `notice`   | ≤ 30 days        | Warning state on dashboard      |
| `ok`       | > 30 days        | No action needed                |

Source: `lib/compliance/expiryBands.ts`

---

## Escalation Rules

Non-compliant and blocked staff trigger an escalation ladder based on how many consecutive days they have been in a failing state.

| Level                   | Trigger (days) | Action                                    |
|------------------------|----------------|-------------------------------------------|
| `worker_notified`       | 0              | In-app notification to worker             |
| `coordinator_escalated` | 3              | Admin fan-out notification (all admins)   |
| `manager_escalated`     | 7              | Admin fan-out notification (all admins)   |

The `non_compliant_since` column on `staff_profiles` tracks when the escalation clock started. It is:
- Set to the current timestamp when a staff member first enters `non_compliant` or `blocked` state.
- Cleared when they return to `compliant` or `warning`.

Each escalation event is recorded in `audit_logs` with `action = 'compliance.escalation'`.

Source: `lib/compliance/escalation.ts`

---

## Risk Scoring

### Per-Staff Risk Score (0–100, higher = more risk)

| Factor                     | Score contribution |
|---------------------------|-------------------|
| State = blocked            | 80 base           |
| State = non_compliant      | 55 base           |
| State = warning            | 20 base           |
| State = compliant          | 0                 |
| Missing DBS / RTW / passport | +5 each         |
| Missing training items     | +2 each (max 10)  |
| Critical expiries (≤7d)    | +4 each           |
| Expired documents          | +3 each           |

### Risk Levels

| Score   | Level      |
|---------|-----------|
| 0–19    | Low       |
| 20–49   | Medium    |
| 50–74   | High      |
| 75–100  | Critical  |

### Org Health Score (0–100, higher = healthier)

```
weighted_compliant = compliant×1.0 + warning×0.7 + non_compliant×0.3 + blocked×0.0
health_score = (weighted_compliant / total_staff) × 100
risk_score   = 100 - health_score
```

Source: `lib/compliance/riskScore.ts`

---

## Scheduled Jobs

### 1. Compliance Sweep — `GET /api/cron/compliance-sweep` (06:00 UTC)

Runs before the digest to ensure fresh state. For every active/pre-employment staff member:

1. Fetches all documents (staff + applicant sources)
2. Computes compliance snapshot (role-aware)
3. Generates in-app notifications for critical expiries and newly expired items
4. Evaluates escalation level, sends admin fan-out if escalation threshold crossed
5. Updates `staff_profiles`:
   - `compliance_state` — cached compliance state
   - `compliance_risk_score` — cached 0-100 risk score
   - `last_sweep_at` — sweep timestamp
   - `non_compliant_since` — set/cleared based on state transition
6. Logs sweep result and escalations to `audit_logs`

### 2. Compliance Reminders — `GET /api/cron/compliance-reminders` (07:00 UTC)

Sends a daily email digest to admin/company_admin recipients per company. Respects:
- `company_notification_preferences.compliance_alerts_enabled`
- 24-hour duplicate guard (skips if digest already sent today)

Digest includes: expired items, expiring soon items, missing items grouped by staff.

---

## Notifications

### Worker In-App Notifications

| Trigger                              | Event type           |
|-------------------------------------|---------------------|
| Critical expiry (≤7 days)           | `compliance_expiring` |
| Newly expired item                  | `compliance_expiring` |
| Individual reminder sent by admin   | `compliance_expiring` |

### Admin In-App Notifications

| Trigger                              | Event type         |
|-------------------------------------|-------------------|
| Escalation threshold crossed         | `compliance_alert` |

Deduplication: notifications are suppressed if an identical unread notification exists within 24 hours.

Source: `lib/notifications/createNotification.ts`

---

## Shift Blocking

Shift assignment (`PATCH /api/admin/shifts/[id]/assign`) performs a readiness check before assigning any staff member. This check:

1. Calculates compliance (role-aware, including job_role)
2. Calls `calculateReadiness(status, compliant, availability)`
3. Rejects with HTTP 422 if `readiness.ready === false`

**Blockers that prevent shift assignment:**
- Staff not `active`
- `compliant === false` (any missing or expired required document/training)
- No availability days set

**Warnings (assignment proceeds but returns `compliance_warning`):**
- Any document expiring within 7 days

---

## Audit Logging

All compliance-related actions are recorded in `audit_logs`:

| Action                      | Trigger                                        |
|-----------------------------|------------------------------------------------|
| `compliance.sweep_result`   | Daily sweep — per-staff state snapshot         |
| `compliance.escalation`     | Escalation level crossed for non-compliant staff |
| `compliance.worker_reminder`| Worker reminder email sent                     |
| `compliance.digest`         | Admin digest email sent                        |
| `document.uploaded`         | Document uploaded                              |
| `document.approved`         | Document approved by admin                     |
| `document.rejected`         | Document rejected by admin                     |
| `shift.assigned`            | Shift directly assigned to staff               |
| `shift.offered`             | Shift broadcast to multiple staff              |

---

## Database Schema Changes (Migration 042)

New columns on `staff_profiles`:

| Column                 | Type        | Purpose                                      |
|-----------------------|-------------|----------------------------------------------|
| `non_compliant_since` | TIMESTAMPTZ | When staff member entered non-compliant state |
| `last_sweep_at`       | TIMESTAMPTZ | Timestamp of last compliance sweep            |
| `compliance_risk_score` | SMALLINT  | Cached risk score 0-100 from last sweep      |
| `compliance_state`    | TEXT        | Cached state from last sweep                 |

New indexes:
- `idx_staff_non_compliant_since` — for escalation duration queries
- `idx_staff_compliance_risk_score` — for risk-ordered dashboard queries

---

## RBAC

Compliance operations respect existing RBAC:

| Permission        | Required for                                   |
|------------------|------------------------------------------------|
| `compliance:read` | Viewing compliance dashboard, alerts, risk score |
| `coordinator`+   | Suspending workers from compliance dashboard   |
| `company_admin`+ | Archiving workers from compliance dashboard    |

Cron jobs use the Supabase admin client (service role key) and do not require user authentication. They are secured by `Authorization: Bearer {CRON_SECRET}`.

---

## Key Files

```
lib/compliance/
  calculateCompliance.ts    — core calculator (role-aware)
  buildComplianceSnapshot.ts — snapshot builder
  requirements.ts           — required document types
  expiryBands.ts            — expiry band logic
  escalation.ts             — escalation tiers + threshold logic
  riskScore.ts              — per-staff + org risk scoring
  reminders.ts              — reminder query logic
  reminderThresholds.ts     — warning/notice day constants
  status.ts                 — item-level status engine

lib/training/
  matrix.ts                 — role-specific training requirements

app/api/cron/
  compliance-sweep/         — daily sweep + escalation job
  compliance-reminders/     — daily email digest job

app/api/admin/compliance/
  staff/                    — per-staff compliance rows API
  alerts/                   — expired + expiring alerts API
  risk-score/               — org risk score + top-risk staff API
  summary/                  — compliance_items aggregate counts
  timeline/                 — per-staff event history
  bulk/                     — bulk reminder actions
  reminders/worker/         — individual worker email reminders
  export/                   — CSV export

supabase/migrations/
  030_compliance_state.sql  — performance indexes for compliance queries
  042_compliance_automation.sql — new columns for escalation tracking
```
