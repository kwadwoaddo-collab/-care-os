# Operational Intelligence Orchestration Engine — Architecture

## Overview

The Orchestration Engine is the unified layer that prevents alert overload by consuming every Care OS intelligence system and producing one ranked, deduplicated, explainable priority stream for coordinators.

Without this layer, coordinators faced separate queues in compliance, incidents, shift coverage, documents, onboarding, visits, and communications — no single view of what matters most.

---

## Core Design Principles

1. **Single priority stream** — one list, ranked by real operational impact
2. **Deduplication first** — related signals about the same worker/client are grouped, not listed separately
3. **Explainability mandatory** — every item answers why it appeared, what triggered it, what happens if ignored, and what to do
4. **Pure computation** — the scoring engine is a pure function with no side effects; DB only stores user-driven state
5. **Preserve all source systems** — the engine consumes existing engines without replacing them

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     Source Intelligence Systems                   │
│                                                                   │
│  Compliance     Onboarding    Documents    Workforce              │
│  Engine         Readiness     Verification  Readiness             │
│                                                                   │
│  Incidents      Safeguarding  Visit         Communications        │
│  Intelligence   Alerts        Anomalies     Acknowledgements      │
│                                                                   │
│  Operations Queue   Wellbeing Signals   Shift Coverage           │
└────────────────────────────┬────────────────────────────────────┘
                             │ Raw signals (typed inputs)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              lib/operations/orchestration.ts                      │
│                                                                   │
│  1. Signal converters (one per source system)                     │
│     - complianceRiskToPriority()                                  │
│     - onboardingToPriority()                                      │
│     - documentVerificationToPriority()                            │
│     - shiftGapToPriority()                                        │
│     - visitAnomalyToPriority()                                    │
│     - incidentToPriority()                                        │
│     - safeguardingAlertToPriority()                               │
│     - communicationToPriority()                                   │
│     - wellbeingSignalToPriority()                                 │
│     - queueItemToPriority()                                       │
│                                                                   │
│  2. Priority scoring engine                                       │
│     - 8-factor score (0-100)                                      │
│     - Severity classification (critical/urgent/warning/info)      │
│                                                                   │
│  3. Deduplication & grouping                                      │
│     - Group by groupKey (entity-based)                            │
│     - Escalate severity for grouped items                         │
│     - Collect linked evidence                                     │
│                                                                   │
│  4. Suppression & focus mode filters                              │
│                                                                   │
│  5. State merging (snooze, acknowledgement, ownership)            │
│                                                                   │
│  6. Sort (severity → score → overdue)                             │
│                                                                   │
│  orchestrate() → OrchestrationResult                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌─────────────────────────┐   ┌────────────────────────────────┐
│  Supabase DB             │   │  API Route                      │
│                         │   │  /api/admin/operations/         │
│  orchestration_         │   │  priorities                     │
│  priority_states        │   │                                 │
│                         │   │  GET  — fetch + orchestrate     │
│  orchestration_         │   │  PATCH — update state           │
│  suppressions           │   │                                 │
│                         │   └────────────────┬───────────────┘
│  orchestration_         │                    │
│  audit_log              │                    ▼
└─────────────────────────┘   ┌────────────────────────────────┐
                               │  UI Components                  │
                               │                                 │
                               │  TopPrioritiesSection.tsx       │
                               │  /admin/operations              │
                               │                                 │
                               │  ExecutiveRiskSummary           │
                               │  /admin/analytics               │
                               └────────────────────────────────┘
```

---

## Priority Scoring Model

Each priority item is scored using 8 independent factors, then normalised to 0–100.

| Factor              | Max Points | Description                                        |
|---------------------|:----------:|-----------------------------------------------------|
| Safeguarding impact |     40     | +25 base for safeguarding type, +escalation, +repeat |
| Client safety impact|     30     | +10 base if client affected, +severity, +missed care |
| Compliance impact   |     25     | Based on compliance state (blocked=20, non_compliant=14, warning=7) |
| Staffing impact     |     20     | Worker blocked or shift uncovered within days      |
| Overdue factor      |     15     | Days overdue × 2, capped at 15                     |
| Escalation level    |     10     | +5 if escalated, +escalation_level × 2             |
| Recurrence factor   |     10     | Repeat count × 3, capped at 10                     |
| Urgency factor      |     15     | Days until shift, days waiting, severity boost     |

**Max raw score: 165**  
**Normalised to 0–100 by: `round(min(100, raw / 165 * 100))`**

### Severity thresholds

| Score | Severity       |
|------:|----------------|
|  75+  | Critical       |
|  50+  | Urgent         |
|  25+  | Warning        |
|   0+  | Informational  |

---

## Deduplication Logic

Items are grouped by `groupKey`, which is structured as:

```
{source}::{entity_type}::{entity_id}
```

Examples:
- `compliance::worker::abc-123` — compliance items for worker abc-123
- `incident::client::def-456` — incidents for client def-456
- `docver::worker::abc-123` — document verification items for worker abc-123

When multiple items share a groupKey:
1. The highest-scored item becomes the group representative
2. The group score is boosted: `min(100, primary_score + (group_count - 1) * 5)`
3. Secondary items become `evidence[]` attached to the primary
4. `isGroup: true` and `groupedCount: N` are set

**Example grouping:**
A worker with expired DBS + non-deployable state + blocked shift + compliance escalation produces 4 signals all keyed to `compliance::worker::abc-123`. The engine collapses them into:

> "Sarah Johnson blocked from deployment — expired DBS"
> Score: 87 · Severity: Critical
> Linked issues: [non-deployable state, 2 blocked shifts, compliance escalation]

---

## Explainability Model

Every `UnifiedPriorityItem` carries a mandatory `explainability` object:

```typescript
interface PriorityExplainability {
  why:         string  // "Why did this appear?"
  triggeredBy: string  // "What data triggered it?"
  consequence: string  // "What happens if ignored?"
  action:      string  // "What should be done?"
}
```

These are generated at score time by each signal converter and displayed in the "Why this matters" expandable panel in the UI.

---

## Recommended Actions

| Action                     | Trigger scenario                                  |
|----------------------------|---------------------------------------------------|
| `request_document`         | Missing/expired document, rejected verification   |
| `approve_document`         | Document awaiting verification                    |
| `schedule_replacement_worker` | Uncovered shift                                |
| `escalate_safeguarding`    | Open safeguarding incident                        |
| `contact_worker`           | Wellbeing signal, onboarding stall                |
| `resolve_queue_item`       | Open queue item                                   |
| `review_client_risk`       | Client-linked incident pattern                    |
| `trigger_communication`    | Unacknowledged communication                      |
| `renew_compliance`         | Compliance warning/expiry                         |
| `review_incident`          | Open non-safeguarding incident                    |
| `complete_onboarding`      | Worker stalled in onboarding                      |
| `investigate_anomaly`      | Visit anomaly detected                            |
| `assign_owner`             | Unowned high-priority item                        |

---

## Priority Lifecycle

```
open → acknowledged → in_progress → resolved
  └──→ snoozed → (auto-reopen at snoozedUntil)
  └──→ escalated
  └──→ dismissed (with reason)
```

All lifecycle transitions are:
1. Persisted to `orchestration_priority_states`
2. Audit-logged to `orchestration_audit_log`
3. Applied at read time when the engine next runs

---

## Alert Fatigue Controls

| Control            | Mechanism                                                        |
|--------------------|------------------------------------------------------------------|
| Suppression windows | Admin-defined time windows that silence a category or source    |
| Snooze             | Per-item snooze with auto-reopen at specified time              |
| Dismiss            | Permanent hide with required reason                             |
| Focus mode         | Toggle that hides all `informational` items                     |
| Deduplication      | Grouped items appear as one, not many                           |

---

## Database Tables

### `orchestration_priority_states`
Stores user-driven state per priority item:
- `priority_id` — engine-generated ID (not a FK)
- `status` — open / acknowledged / in_progress / snoozed / resolved / escalated / dismissed
- Snooze, acknowledgement, resolution, dismissal fields with actor + timestamp

### `orchestration_suppressions`
Admin-defined suppression windows:
- Optional `category` and `source_id` scoping
- `suppress_until` timestamp
- Automatically ignored once expired

### `orchestration_audit_log`
Immutable audit trail:
- Every state transition logged with actor, timestamp, note, metadata
- Actions: `priority_generated | priority_grouped | acknowledged | assigned | snoozed | resolved | escalated | dismissed`

All tables: RLS enabled with company isolation + service role bypass.

---

## Integration Points (Preserved)

| System                   | File                                      | Role in engine              |
|--------------------------|-------------------------------------------|-----------------------------|
| Compliance engine        | `lib/compliance/calculateCompliance.ts`   | Source: compliance risks    |
| Compliance risk scoring  | `lib/compliance/riskScore.ts`             | Score inputs for compliance |
| Readiness engine         | `lib/onboarding/readiness.ts`             | Source: worker readiness    |
| Deployability engine     | `lib/workforce/readinessEngine.ts`        | Source: blocked workers     |
| Incident risk engine     | `lib/incidents/riskEngine.ts`             | Source: incidents           |
| Document lifecycle       | `lib/documents/lifecycle.ts`              | Source: doc backlog         |
| Document verification    | `lib/documents/verification.ts`           | Source: verification queue  |
| Operations queue         | `lib/operations/priorityQueue.ts`         | Source: queue items         |
| Operational feed         | `lib/workforce/operationalFeed.ts`        | Parallel alert feed         |
| Communications           | `lib/communications/deliver.ts`           | Source: unacknowledged comms|
| RBAC                     | `lib/rbac/`                               | Access control preserved    |
| Audit logging            | `lib/logger.ts`                           | All actions logged          |
| Tenant isolation         | All Supabase queries: `company_id` scoped | Multi-tenancy preserved     |

---

## API Reference

### `GET /api/admin/operations/priorities`

Returns the full orchestrated priority stream.

Query params:
- `?focus=1` — Focus mode (hides informational items)

Response: `OrchestrationResult`
```typescript
{
  priorities: UnifiedPriorityItem[]
  summary: {
    critical: number
    urgent: number
    warning: number
    informational: number
    total: number
    topRisk: UnifiedPriorityItem[]  // top 5
    trend: 'worsening' | 'stable' | 'improving'
  }
  generatedAt: string
}
```

### `PATCH /api/admin/operations/priorities`

Update the lifecycle state of a priority item.

Body:
```typescript
{
  priorityId:    string
  action:        'acknowledged' | 'assigned' | 'snoozed' | 'resolved' | 'escalated' | 'dismissed'
  owner?:        string
  ownerId?:      string
  snoozedUntil?: string  // ISO datetime
  note?:         string
}
```

---

## UI Surface

### `/admin/operations` — Top Priorities Section

- Summary bar with severity counts
- Severity sections (Critical / Urgent / Warning / Informational), collapsible
- Each priority card:
  - Severity bar + badge
  - Title, description, affected entities
  - Recommended action button → deep link
  - "Why this matters" expandable panel (explainability + impact)
  - Action menu (acknowledge / assign / snooze / resolve / escalate / dismiss)
  - Score bar

### `/admin/analytics` — Executive Risk Summary

- Critical / Urgent / Warning / Total count tiles
- Top 5 risks list with severity badge + score
- Priority aging metrics (>24h, >7d open)
- Link to full priority stream

---

## Extension Points

To add a new signal source to the orchestration engine:

1. Define a typed input interface (e.g., `XyzInput`)
2. Write a converter function: `xyzToPriority(input: XyzInput): UnifiedPriorityItem`
3. Add `xyz: XyzInput[]` to `OrchestrationInput`
4. Call converter in `orchestrate()` under the appropriate section
5. Fetch source data in the API route and map to the input type

No changes to scoring, deduplication, suppression, or UI are needed.
