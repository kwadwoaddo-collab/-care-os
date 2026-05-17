# Care Delivery Execution Architecture

## Overview

The Care Delivery Execution layer transforms Care OS from an admin/compliance platform into an active operational delivery system. It extends the existing shift, timesheet, and visit-notes infrastructure with structured care task checklists, medication administration records, anomaly detection, field escalation, and a live visit operations dashboard.

---

## Design Principles

1. **Extend, don't replace** — all new tables link to existing `shifts`, `timesheets`, and `visit_notes` via FK. The existing worker clock-in/out and visit note flows remain intact.
2. **Worker-first UX** — the execution flow is mobile-optimised, sequential, and progressive: Briefing → Checklist → Medication → Depart.
3. **Automatic audit trail** — every action (arrival, task completion, medication, escalation, departure) writes to `audit_logs`.
4. **Anomaly detection without ML** — rule-based scanning detects late arrivals, short visits, medication issues, and no-shows using the existing timesheet data.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Admin: Visit Operations Dashboard               │
│                   /admin/visits                              │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────────────┐  │
│  │ Live Visits│ │Overdue Visits│ │ Anomalies /admin/visits│  │
│  │ KPI bar    │ │ Missed count │ │ /anomalies             │  │
│  └────────────┘ └──────────────┘ └───────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼──────────────────────┐
         ▼                 ▼                       ▼
┌─────────────────┐ ┌──────────────┐  ┌──────────────────────┐
│ /api/admin/     │ │/api/admin/   │  │  Supabase DB (049)   │
│ visits          │ │visits/       │  │  visit_task_items    │
│ (live dashboard)│ │anomalies     │  │  visit_medication_   │
│                 │ │(scan+resolve)│  │    records           │
└─────────────────┘ └──────────────┘  │  visit_anomalies     │
                                       │  + visit_notes       │
                                       │    (new columns)     │
                                       └──────────────────────┘
                                                  ▲
         ┌────────────────────────────────────────┘
         │
┌─────────────────────────────────────────────────────────────┐
│                 Worker: Visit Execution Portal               │
│               /worker/visits/[shiftId]                       │
│  Tab 1: Briefing  → Confirm Arrival                         │
│  Tab 2: Checklist → Complete / Skip / Refuse tasks          │
│  Tab 3: Medication→ Record administrations / refusals       │
│  Tab 4: Escalate  → Raise concern → incident + notification │
│  Complete: Depart → clock-out + complete shift              │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────────┐
         ▼                 ▼                      ▼
┌─────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ /arrive     │  │ /checklist       │  │ /medication          │
│ /depart     │  │ GET task list    │  │ GET/POST med records │
│ /missed     │  │ POST add task    │  │ Escalation flags     │
│ /guidance   │  │ PATCH update     │  │                      │
│ /escalate   │  └──────────────────┘  └──────────────────────┘
└─────────────┘
```

---

## Database Schema (Migration 049)

### `visit_notes` — new columns

| Column | Type | Purpose |
|--------|------|---------|
| `arrived_at` | TIMESTAMPTZ | Worker arrival confirmation timestamp |
| `departed_at` | TIMESTAMPTZ | Worker departure timestamp |
| `visit_duration_minutes` | INT | Computed duration in minutes |
| `is_missed` | BOOLEAN | TRUE if visit was recorded as missed |
| `missed_reason` | TEXT | Reason for missed visit |
| `missed_at` | TIMESTAMPTZ | When missed was recorded |
| `escalation_raised` | BOOLEAN | TRUE if any escalation was raised |
| `escalation_type` | TEXT | safeguarding / medical / medication / operational / other |
| `escalation_notes` | TEXT | Description from worker |
| `escalation_raised_at` | TIMESTAMPTZ | When escalation was raised |

### `visit_task_items`

Per-visit structured care task checklist. Replaces the free-text `care_tasks_completed` JSONB in `visit_notes`.

| Column | Notes |
|--------|-------|
| `task_type` | care / medication / observation / wellbeing / risk |
| `task_name` | Displayed to worker |
| `status` | pending / completed / skipped / partial / refused |
| `refused_reason` | Text if status = refused |
| `completed_at` | Timestamp |
| `completed_by` | staff_profiles.id |
| `sequence_order` | Display order |

**Default task set** (seeded on arrival):
1. Wellbeing check (wellbeing)
2. Personal hygiene / washing (care)
3. Dressing and grooming (care)
4. Meal preparation and assistance (care)
5. Record food and fluid intake (observation)
6. Check environment for hazards (risk)

### `visit_medication_records`

Structured medication administration per visit. One row per medication per visit.

| Column | Notes |
|--------|-------|
| `medication_name` | Text |
| `dose` | e.g. "10mg" |
| `route` | oral / topical / inhaled / injection |
| `action` | administered / refused / unavailable / missed / prn |
| `administered_at` | Timestamp for administered/prn |
| `refused_reason` | Required if refused |
| `prn_reason` | Required if prn |
| `requires_escalation` | TRUE for refused / missed / unavailable |
| `escalated` | Set to TRUE once escalation is processed |
| `incident_id` | FK to incidents if an incident was created |

**Escalation logic:** `action IN ('refused', 'missed', 'unavailable')` → sets `requires_escalation = TRUE` automatically, flags the visit note with `medication_prompted = TRUE`.

### `visit_anomalies`

Auto-detected and manually flagged operational anomalies.

| Anomaly Type | Trigger | Severity |
|--------------|---------|----------|
| `late_arrival` | lateness_minutes >= 15 | warning (30+: critical) |
| `short_visit` | worked_minutes < 80% of scheduled | warning (<50%: critical) |
| `no_show` | past start time + 30m, no clock-in | critical |
| `medication_anomaly` | requires_escalation=true, not escalated | critical |
| `escalation_raised` | worker raised field escalation | warning/critical |

---

## Visit Execution Flow (Worker)

```
Worker opens /worker/visits/[shiftId]
     │
     ▼
Tab 1: BRIEFING
  ├── View client risk level + safeguarding alerts
  ├── View coordinator notes
  ├── View previous medication summary
  ├── View escalation contacts
  └── Tap "Confirm Arrival"
       ├── POST /arrive → arrived_at, in_progress status, clock-in timesheet
       ├── Seed 6 default care tasks in visit_task_items
       └── Advance to Tab 2

Tab 2: CHECKLIST
  ├── View task list (care / wellbeing / observation / risk)
  ├── Mark each: Completed / Partial / Skipped / Refused
  ├── Add custom tasks
  └── Continue to Medication

Tab 3: MEDICATION
  ├── View previous med records for this visit
  ├── Record: Administered / Refused / Unavailable / Missed / PRN
  ├── Refused/Missed auto-flags requires_escalation
  └── Tap "End Visit & Depart"
       ├── POST /depart → departed_at, clock-out, shift status=completed
       └── Phase = COMPLETE

Tab 4: ESCALATE (available any time after arrival)
  ├── Select: safeguarding / medical / medication / operational / other
  ├── Enter description
  └── Tap "Raise Escalation"
       ├── Updates visit_note with escalation fields
       ├── Creates incident record (existing incidents table)
       ├── Creates visit_anomaly (escalation_raised)
       └── Fan-out in-app notification to all admins/coordinators
```

---

## Anomaly Detection Scan

`POST /api/admin/visits/anomalies` runs four checks:

1. **Late arrivals** — scans `timesheets` where `lateness_minutes >= 15` today. Skips if anomaly already recorded.
2. **Short visits** — scans `timesheets` where `status=completed` and `worked_minutes < 80%` of scheduled duration.
3. **Medication anomalies** — scans `visit_medication_records` where `requires_escalation=true AND escalated=false`.
4. **No-shows** — scans `shifts` scheduled today that started >30 min ago with no `timesheets` row.

Supports `dry_run: true` — returns counts without writing any rows.

Anomalies are idempotent: won't create duplicates if already recorded for a shift.

---

## Visit Operations Dashboard (`/admin/visits`)

Auto-refreshes every 60 seconds. Shows:

| Section | Content |
|---------|---------|
| KPI bar | Live visits, overdue, missed, completed today, medication alerts, anomalies, task completion rate, avg lateness |
| Live Visits | Shifts with clock_in but no clock_out, not missed |
| Overdue Visits | Shifts past start time (>15 min) with no clock-in |
| Missed Visits | Shifts with is_missed=true or status=missed |
| Anomaly banner | Shown when unresolved_anomalies > 0, links to /admin/visits/anomalies |

---

## Worker Visit Guidance

`GET /api/worker/visits/[shiftId]/guidance` returns:

- **Shift details** — title, date, times, location, type, notes
- **Client** — name, risk level, funding type
- **Care package** — title, weekly hours
- **Safeguarding alerts** — open high/critical incidents for the client (last 3)
- **Previous medication** — last submitted visit's medication records
- **Escalation contacts** — registered managers and coordinators

---

## Field Escalation Workflow

1. Worker taps **Raise Escalation** on `/worker/visits/[shiftId]`
2. Selects type + writes description
3. Server:
   - Updates `visit_notes.escalation_raised = TRUE`
   - Creates `incidents` record (linked to shift + client)
   - Creates `visit_anomalies` record (type: escalation_raised)
   - Calls `createNotification({recipient: 'admin'})` → fans out to all admins/coordinators
4. Worker sees confirmation + incident link

---

## Missed Visit Recording

`POST /api/worker/visits/[shiftId]/missed`:
- Upserts `visit_notes` with `is_missed=TRUE`, `missed_reason`, `missed_at`
- Sets `shifts.status = 'missed'`
- Sets `timesheets.status = 'missed'` (if exists)
- Creates `visit_anomalies` record (type: no_show, severity: critical)

---

## Audit Trail

Every action writes to `audit_logs`:

| Action | Trigger |
|--------|---------|
| `visit.arrived` | Worker confirms arrival |
| `visit.departed` | Worker confirms departure |
| `visit.missed` | Worker records missed visit |
| `visit.escalation_raised` | Worker raises field concern |
| `medication.{action}` | Each medication record created |
| `visit_anomalies.scan` | Admin runs anomaly detection |

---

## Integration Points

| System | Integration |
|--------|-------------|
| `timesheets` | Arrival = clock-in, Departure = clock-out |
| `shifts` | Status: accepted → in_progress → completed / missed |
| `incidents` | Escalations create incident records |
| `in_app_notifications` | Escalations fan-out to admin via createNotification |
| `visit_notes` | New columns extend existing note; task/med tables FK to it |
| `audit_logs` | All actions logged |
| Operations queue | Anomaly scan can be run from ops dashboard |
| Communications | Safeguarding escalation can trigger broadcast |

---

## File Map

```
supabase/migrations/
  049_care_delivery_execution.sql

app/api/admin/visits/
  route.ts                 — live dashboard data (live/overdue/missed/KPIs)
  anomalies/route.ts       — GET list / POST scan / PATCH resolve

app/api/worker/visits/[shiftId]/
  guidance/route.ts        — client info, risks, contacts, prev meds
  arrive/route.ts          — arrival confirmation, clock-in, visit note create
  depart/route.ts          — departure, clock-out, shift complete
  missed/route.ts          — missed visit recording
  checklist/route.ts       — GET/POST/PATCH care task items
  medication/route.ts      — GET/POST medication records
  escalate/route.ts        — field escalation, incident creation, notification

app/admin/visits/
  page.tsx                 — Visit Operations Dashboard (auto-refresh 60s)
  anomalies/page.tsx       — Anomaly list with resolve action

app/worker/visits/[shiftId]/
  page.tsx                 — Full visit execution flow (4-tab progressive UI)
```
