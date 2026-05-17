# Worker Portal Phase 2 — Field Operations Architecture

## Overview

Phase 2 transforms the worker portal from a basic onboarding/shift viewer into a calm, operationally intelligent field application. It is optimised for carers and support workers doing domiciliary and supported living work — people who need fast, reliable tools on a mobile phone, often in challenging environments.

The design philosophy: **reduce cognitive load, surface what matters now, make errors recoverable**.

---

## New Routes

### Pages

| Route | Purpose |
|---|---|
| `/worker/tasks` | Unified Task Centre — pending visit tasks, docs, shift confirmations |
| `/worker/timeline` | Chronological shift/visit timeline with travel gaps and status markers |
| `/worker/performance` | Worker's own attendance, compliance, visit, and onboarding metrics |
| `/worker/safety` | Emergency safety alert form — raises incident + notifies all admins |

### API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/worker/wellbeing` | GET | Calculates fatigue/overload signals from timesheet data |
| `/api/worker/tasks` | GET | Aggregates pending visit tasks, expiring docs, unacked shifts |
| `/api/worker/tasks` | PATCH | Marks a visit task item complete (with optional note) |
| `/api/worker/safety` | POST | Creates critical incident + notifies all admin/coordinator profiles |
| `/api/worker/performance` | GET | 30-day attendance, compliance, visit note, and onboarding stats |

---

## Feature Breakdown

### 1. Enhanced Home Dashboard (`/worker/dashboard`)

**New data sources loaded on page mount:**
- `/api/worker/wellbeing` — fatigue flags and human-readable warnings
- `/api/worker/messages` — unread count badge
- `/api/worker/tasks` — pending task count badge

**New UI sections:**
- Offline banner (no connection detected)
- Sync banner (queued offline actions pending upload)
- Wellbeing notice (overtime, consecutive days, insufficient break)
- Task count callout → links to `/worker/tasks`
- Unread messages callout → links to `/worker/messages`
- Safety quick-access strip (Emergency Alert + Contact Coordinator)
- Updated quick actions: Timeline, Availability, Upload Doc, My Progress

---

### 2. Shift Timeline View (`/worker/timeline`)

Renders shifts grouped by date with a vertical spine. Each day shows:
- Date heading with today highlight
- Shift cards with: status dot, duration, client name, location
- Travel gap indicators between consecutive same-day visits
- Status markers: Overdue, Unconfirmed, Note ✓
- Period filter: Today / This Week / This Month

Accessible from Dashboard quick actions and from Shifts list view header.

---

### 3. Worker Task Centre (`/worker/tasks`)

Three task categories aggregated in a single screen:

**Shift Confirmations** — shifts with `worker_ack_status IS NULL` in the future  
**Documents Needed** — documents expiring within 30 days or already expired  
**Visit Tasks** — `visit_task_items` with `status = 'pending'` on open visit notes

Each visit task supports:
- One-tap Mark Done
- Request Help (opens textarea; note saved on the task record and visible to coordinators)
- Direct link to the Visit execution page

Offline detection disables write actions gracefully.

---

### 4. Worker Wellbeing Signals (`/api/worker/wellbeing`)

**Inputs:** Last 14 days of timesheet records (worked_minutes, break_minutes, shift_date)

**Calculated flags:**
| Flag | Condition |
|---|---|
| `excessive_overtime` | Hours this week > 48 |
| `excessive_consecutive` | Consecutive working days > 5 |
| `insufficient_break` | Any completed shift with worked > 6h and break < 20min |
| `overloaded` | Hours this week > 40 AND consecutive days > 4 |

Each flag generates a human-readable warning string shown on the dashboard. No automated action is taken — the warnings prompt the worker to contact their coordinator.

---

### 5. Real-Time Operational Guidance Enhancements

During visits (`/worker/visits/[shiftId]`), the Briefing tab now additionally shows:
- **Key risk card** — displayed when client risk level is `high` or `critical`
- **Care package context** — package title linked to the shift
- **Escalation contacts as phone links** (`tel:` href) instead of email-only
- **Safety button** in the page header — one tap to `/worker/safety`

---

### 6. Worker Communication Hub Improvements

**Urgent broadcast banners** — messages with `priority = 'critical'` and no `acknowledged_at` render as full-width red banner cards above the message list. Each banner has a prominent "I have read this" acknowledgement button that:
- PATCHes the message record (marks read + acknowledged)
- Removes the banner immediately (optimistic)

Existing filter tabs (All, Unread, Compliance, Shifts) are preserved.

---

### 7. Offline / Low Connectivity Resilience

**Detection:** `useOnlineStatus` hook uses `navigator.onLine` + online/offline window events.

**Visual indicators:**
- Offline banner on Dashboard, Task Centre, Visit execution, Safety page
- Write actions disabled with clear messaging when offline

**Queued actions:** `offlineQueue.ts` provides a `localStorage`-backed queue for deferred API calls:
- `enqueue(action)` — stores action with URL, method, body, label
- `flushQueue()` — replays all queued actions on reconnect
- Dashboard detects pending queue on mount and attempts flush when `online` becomes true

---

### 8. Simplified Mobile UX

- Bottom nav updated: Home / Tasks / Shifts / Messages / Docs (Tasks replaces Onboarding)
- Onboarding CTA surfaced prominently on dashboard for incomplete workers
- All action buttons use `min-h-[44px]` (Apple HIG touch target minimum)
- `active:scale-[0.98]` / `active:scale-95` on interactive cards for tactile feedback
- Timeline spine layout reduces horizontal cognitive load
- Offline banners surface above fold so workers see connection state immediately

---

### 9. Worker Performance Transparency (`/worker/performance`)

SVG score rings for: Attendance %, Compliance %, Onboarding %

Stat cards: Visits Done, Visit Notes, Missed Shifts (if any), Expired Docs (if any)

Acknowledgement history (last 15 shifts where the worker responded) showing Confirmed / Declined / Running Late.

All data scoped to the last 30 days. No admin-only fields exposed.

---

### 10. Worker Safety Features (`/worker/safety`)

Four alert types the worker can raise:
- Emergency (life-threatening)
- Unsafe Environment (environmental hazard)
- Welfare Check Needed (client at risk)
- Request Support (management help needed)

On submit:
1. Creates an `incidents` row with `severity = 'critical'`, `status = 'open'`
2. Fans out an `in_app_notification` to all admins/coordinators in the company via `createNotification`
3. Writes an audit log entry
4. Shows confirmation with incident reference

The form prominently displays a `tel:999` call link before the alert form. Offline state blocks submission with an instruction to call 999.

The 🚨 Safety button in the visit execution header provides one-tap access during a visit.

---

## Preserved Systems

All existing systems are fully preserved:

| System | Status |
|---|---|
| RBAC via `validateWorkerToken` | ✅ Unchanged |
| Audit logging | ✅ Extended for safety alerts |
| Communications infrastructure (`createNotification`) | ✅ Used by safety alerts |
| Visit execution engine (arrive, checklist, medication, depart) | ✅ Enhanced, not replaced |
| Compliance tracking and document management | ✅ Unchanged |
| Shift acknowledgement system | ✅ Unchanged |
| Magic link authentication | ✅ Unchanged |

---

## Data Flow Summary

```
Worker opens app
  └── Dashboard loads (6 parallel fetches)
        ├── /api/worker/validate        → profile, status, onboarding
        ├── /api/worker/shifts          → today + upcoming shifts
        ├── /api/worker/documents       → expiry status
        ├── /api/worker/timesheets      → hours this week
        ├── /api/worker/wellbeing       → fatigue flags
        ├── /api/worker/messages        → unread count
        └── /api/worker/tasks           → pending task count

Worker taps Tasks
  └── /api/worker/tasks GET
        ├── visit_notes (worker's open notes)
        │     └── visit_task_items (pending)
        ├── documents (expiring / expired)
        └── shifts (unacknowledged)

Worker taps Safety
  └── /api/worker/safety POST
        ├── incidents INSERT (critical)
        ├── createNotification → admin fan-out
        └── audit_logs INSERT
```

---

## File Index

```
app/
  api/worker/
    wellbeing/route.ts        — fatigue/wellbeing signals
    tasks/route.ts            — aggregated task list + PATCH
    safety/route.ts           — emergency alert creation
    performance/route.ts      — 30-day performance metrics
  worker/
    tasks/page.tsx            — Task Centre
    timeline/page.tsx         — Shift Timeline
    performance/page.tsx      — Worker Progress
    safety/page.tsx           — Emergency Safety Alert
    dashboard/page.tsx        — ENHANCED
    visits/[shiftId]/page.tsx — ENHANCED
    messages/page.tsx         — ENHANCED
    layout.tsx                — UPDATED (nav: Tasks tab)

lib/
  hooks/useOnlineStatus.ts    — online/offline detection hook
  utils/offlineQueue.ts       — localStorage-backed action queue
```
