# Scheduling Intelligence & Safe Assignment Enforcement

## Overview

Care OS enforces assignment safety at multiple layers. Every shift assignment passes through a safety engine that evaluates compliance, fatigue, availability, and workload before a worker is assigned.

---

## Architecture

```
Shift Assignment Request
         │
         ▼
┌────────────────────────────────────────┐
│          Assignment Safety Engine       │
│   lib/scheduling/assignmentSafety.ts   │
│                                        │
│  1. Staff status check                 │
│  2. Onboarding completion              │
│  3. Compliance state + overrides       │
│  4. Expiring credential warnings       │
│  5. Shift overlap detection            │
│  6. Availability (day + date)          │
│  7. Weekly hours (warn/block)          │
│  8. Rest period (UK WTR 11h)           │
│  9. Consecutive days (warn at 5, block at 7) │
│  10. Night→day transition (fatigue)    │
│  11. Late acknowledgement pattern      │
│  12. Same-day workload                 │
└────────────────────────┬───────────────┘
                         │
              ┌──────────▼──────────┐
              │   AssignmentOutcome  │
              │                     │
              │  safe_to_assign     │
              │  assign_with_warning │
              │  blocked_assignment  │
              └──────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   Proceed          Show warnings    Block + explain
   (assign)         (assign allowed) (override path)
```

---

## Core Modules

### `lib/scheduling/assignmentSafety.ts`

The master safety engine. Takes a `SafetyInput` and returns `AssignmentSafetyResult`:

```typescript
interface AssignmentSafetyResult {
  outcome:  'safe_to_assign' | 'assign_with_warning' | 'blocked_assignment'
  blocks:   SafetyCheck[]    // hard blockers
  warnings: SafetyCheck[]    // soft warnings
  passed:   SafetyCheck[]    // checks that passed
  summary:  string           // one-line summary
}

interface SafetyCheck {
  id:                string   // unique check key
  result:            'pass' | 'warn' | 'block'
  severity:          'critical' | 'high' | 'medium' | 'low'
  rule:              string   // machine-readable rule name
  message:           string   // short human message
  detail:            string   // full explanation
  recommendedAction: string   // what to do
  overridePath:      string | null  // how to override if applicable
  affectedItem:      string | null  // e.g. "DBS Certificate"
  daysUntilExpiry:   number | null  // for expiry-related checks
}
```

Each check produces a `SafetyCheck` with:
- **Exact reason** — human-readable `message` + `detail`
- **Severity** — `critical | high | medium | low`
- **Affected rule** — machine-readable `rule` field (e.g. `rest_period`, `compliance_state`)
- **Recommended action** — specific `recommendedAction` text
- **Override path** — `overridePath` describes who can override and how

### `lib/scheduling/restPeriod.ts`

Fatigue and rest period detection:

- `checkRestPeriod()` — UK Working Time Regulations 11h minimum; blocks at < 8h
- `checkConsecutiveDays()` — warns at 5 consecutive days, blocks at 7
- `checkNightDayFlip()` — detects night shift → early day shift < 9h gap
- `checkFatigue()` — combined result of all three

### `lib/scheduling/staffingRisk.ts`

Structural workforce risk detection. Detects:

| Risk Type | Description | Level |
|-----------|-------------|-------|
| `single_point_of_failure` | Only 1 deployable worker for a role | Critical |
| `role_shortage` | 0 deployable for a role with ≥3 total | High |
| `weekend_coverage_low` | < 2 deployable staff available weekends | Critical/High |
| `night_coverage_low` | < 2 night-capable deployable staff | Critical/High |
| `expiry_cluster` | ≥2 workers in same role with expiry within 14d | Medium–Critical |

---

## API Endpoints

### `GET /api/admin/shifts/[id]/safety-check?staff_profile_id=...`

Full pre-assignment safety evaluation for a specific staff+shift pair.

**Input:** Shift ID (path), Staff Profile ID (query param)

**Output:**
```json
{
  "staffId": "...",
  "shiftId": "...",
  "staffName": "Jane Smith",
  "outcome": "assign_with_warning",
  "summary": "2 warnings: DBS Certificate expires in 5 days",
  "blocks": [],
  "warnings": [
    {
      "id": "expiry_7d_dbs",
      "result": "warn",
      "severity": "medium",
      "rule": "compliance_expiry",
      "message": "DBS Certificate expires in 5 days",
      "detail": "DBS Certificate expires within 7 days...",
      "recommendedAction": "Arrange renewal...",
      "overridePath": null,
      "affectedItem": "DBS Certificate",
      "daysUntilExpiry": 5
    }
  ],
  "passed": [...]
}
```

### `GET /api/admin/scheduling/staffing-risk`

Company-wide staffing risk profile.

**Output:**
```json
{
  "risks": [
    {
      "id": "spof_care_worker",
      "type": "single_point_of_failure",
      "level": "critical",
      "title": "Single point of failure: care worker",
      "description": "Only 1 deployable worker...",
      "affectedRole": "care_worker",
      "count": 1,
      "threshold": 2,
      "recommendation": "Resolve compliance blocks..."
    }
  ],
  "summary": {
    "totalRisks": 3,
    "critical": 1,
    "high": 2,
    "medium": 0,
    "totalDeployable": 8,
    "canWorkWeekends": 3,
    "canWorkNights": 2
  },
  "asOf": "2026-05-17T10:00:00Z"
}
```

### `GET /api/admin/shifts/[id]/recommendations`

Enhanced candidate ranking — now includes full safety outcome per candidate.

**New fields in each recommendation:**
```json
{
  "safety_outcome": "assign_with_warning",
  "safety_summary": "2 warnings: DBS expires in 5 days",
  "safety_block_count": 0,
  "safety_warning_count": 2,
  "top_block": null,
  "top_warning": "DBS Certificate expires in 5 days"
}
```

**Ranking order:** Safe → Warned → Blocked, then by score descending.

### `PATCH /api/admin/shifts/[id]/assign`

Enhanced with:
- Rest period checks (7-day window, blocks at < 8h, warns at < 11h)
- Consecutive days check (warns at 5, blocks at 7)
- Richer audit log entries (compliance warning, shift metadata, assignment type)

---

## Smart Candidate Ranking

Candidates are ranked by:

1. **Safety outcome** — Safe > Warned > Blocked
2. **Assignment score** (0–100), combining:
   - Deployability/readiness score (40 pts)
   - Availability window match (25 pts)
   - Client continuity (15 pts)
   - Shift type preference (10 pts)
   - Low same-day workload (10 pts)

---

## Overtime & Fatigue Protection

| Threshold | Action |
|-----------|--------|
| < 8h rest between shifts | **Block** assignment |
| < 11h rest | Warning |
| ≥ 7 consecutive days | **Block** assignment |
| ≥ 5 consecutive days | Warning |
| Night → day shift < 9h | Warning |
| > 60h projected weekly | **Block** assignment |
| > 48h projected weekly | Warning |
| > worker's max weekly hours | Warning |

---

## Assignment Audit Trail

Every assignment logs to `audit_logs`:

```
action: 'shift.assigned' | 'shift.offered'
metadata: {
  target_staff_ids: string[]
  compliance_warning: boolean
  shift_date: string
  shift_title: string
  assignment_type: 'direct' | 'broadcast'
}
```

Override usage logs separately as `compliance.override_used`.

---

## Preserved Systems

The following existing systems are preserved and unchanged:

- **Compliance engine** — `lib/compliance/calculateCompliance.ts`
- **Compliance explainability** — `lib/compliance/explainability.ts`
- **Compliance overrides** — `compliance_overrides` table + API
- **RBAC permissions** — `lib/rbac/permissions.ts` (compliance:override)
- **Deployability engine** — `lib/workforce/readinessEngine.ts`
- **Workforce capacity dashboard** — `/admin/workforce/capacity`
- **Existing shift flows** — open shifts, offer broadcasts, worker ack

---

## UI Integration

### AssignShiftModal

The assign modal now shows three candidate groups:
- **Safe to assign** — green badge, assign button
- **Assign with warnings** — amber badge + warning count, assign button (amber)
- **Blocked** — red badge, no assign button, block reason shown

Clicking a candidate name expands a detail panel showing blockers, warnings, and assignment strengths.

---

## Files

```
lib/scheduling/
  assignmentSafety.ts    — master safety engine (new)
  restPeriod.ts          — fatigue + rest period checks (new)
  staffingRisk.ts        — structural workforce risk detection (new)
  detectConflicts.ts     — existing conflict detection (preserved)
  weeklyHoursRisk.ts     — weekly hours (preserved)
  lateAcknowledgement.ts — ack pattern (preserved)
  index.ts               — updated exports

app/api/admin/shifts/[id]/
  safety-check/route.ts  — pre-assignment full safety check (new)
  recommendations/route.ts — enhanced with safety engine (updated)
  assign/route.ts        — + rest period/consecutive days checks (updated)

app/api/admin/scheduling/
  staffing-risk/route.ts — structural risk detection API (new)

app/admin/shifts/
  AssignShiftModal.tsx   — enhanced with safety outcomes (updated)
```
