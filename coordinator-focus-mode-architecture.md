# Coordinator Focus Mode & Workflow Simplification — Architecture

## Overview

Focus Mode reduces coordinator cognitive overload during busy care operations by
filtering the Operations Control Center to show only what requires immediate action,
suppressing low-priority noise, and surfacing contextual quick actions directly beside
each operational problem.

---

## Core Principles

1. **Signal over noise** — Focus Mode hides anything a coordinator doesn't need to act on right now.
2. **Action beside problem** — every operational issue shows its resolution action inline.
3. **Memory over repetition** — filter preferences, sort choices, and collapsed panels persist to localStorage so coordinators don't re-configure on every visit.
4. **Clear before quiet** — the UI defaults to a calm, low-colour state; alerts only escalate to red/orange when action is genuinely required.

---

## Feature Map

### 1. Focus Mode Toggle
**Where:** Operations Control Center header  
**How:** Click the `⚡ Focus` button. State persists in `localStorage['care-os:occ:focus-mode']`.

**When enabled, the OCC suppresses:**
- Secondary KPI row (overrides, docs, overdue)
- Feed events with severity `info` or `low`
- Queue items with priority `informational` or `warning`
- Compliance alerts for docs expiring in > 7 days
- Safeguarding section when `open_count === 0`
- Shift coverage section when `uncovered === 0` and there are shifts
- Handover section when there are no flagged items

**Always shown in Focus Mode:**
- Critical banner (safeguarding + critical queue + uncovered shifts)
- Safeguarding section with open incidents
- Priority queue — critical and urgent items only
- Feed — critical and high severity events only
- Shift coverage — only if uncovered > 0
- Compliance alerts — only expired or ≤ 7 days

### 2. Smart Prioritization

Queue items are scored for display order by `smartScore()`:

```
score = PRIORITY_ORDER[priority]          // 1–4
      + (category === 'safeguarding' ? 0.5 : 0)  // safeguarding float
      + (due_date < now ? 0.3 : 0)               // overdue float
```

Safeguarding items always appear above other items of the same priority tier.
Overdue items (past their `due_date`) float within their tier.

Sort modes are persisted per user:
- **Smart sort** (default) — uses the score above
- **By due date** — ascending chronological
- **By created** — newest first

### 3. Contextual Quick Actions

Each operational problem surfaces a targeted action button inline:

| Problem | Quick Action |
|---------|-------------|
| Uncovered shift | Assign → `/admin/shifts` |
| Safeguarding incident | Review → `/admin/incidents/{id}` |
| Expired DBS/RTW | Urgent/Renew → `/admin/staff/{id}` |
| Queue item (any) | ✓ quick resolve (inline PATCH) |
| Queue item | View → `entity_url` |
| No handover today | + Create handover note |

All quick-resolve buttons call `PATCH /api/admin/operations/queue/{id}` with `status: resolved` and optimistically remove the row from the UI.

### 4. Workspace Memory

Persisted to `localStorage` under `care-os:occ:*` keys. Never stored server-side.

| Key | Content | Default |
|-----|---------|---------|
| `care-os:occ:focus-mode` | boolean | `false` |
| `care-os:occ:queue-prefs` | `{ filterPriority, filterCategory, filterStatus, sortBy }` | `{ filterStatus: 'open', sortBy: 'priority' }` |
| `care-os:occ:collapsed-sections` | `{ [sectionId]: boolean }` | all open |
| `care-os:occ:tab:{namespace}` | string | varies |

`workspaceMemory.ts` provides safe read/write helpers that handle SSR (returns defaults during server render), localStorage quota errors (silently swallow), and JSON parse failures.

### 5. Collapsible Sections

Every panel in the OCC is wrapped in `<CollapsibleSection>`. Collapse state is:
- Stored in `collapsed-sections` memory key
- Restored on next visit
- Overridable by `focusModeForce` prop — critical sections cannot be collapsed when Focus Mode is on

### 6. Smart Empty States

All panels show operational context instead of generic "no data" messages:

| Panel | Clear message |
|-------|---------------|
| Shift coverage | "All N shifts are covered. Coverage is stable for the next 24 hours." |
| Safeguarding | "No active safeguarding escalations." |
| Priority queue | "All operational queue items are resolved." / "No critical or urgent items right now." |
| Compliance | "No critical compliance documents expiring soon. DBS and right to work checks are up to date." |
| Live feed | "No critical or high-severity events recently." |

### 7. Notification Deduplication

The live feed deduplicates events using a `Set<string>` keyed on `type:entity_id`.
Multiple events of the same type for the same entity within a render are collapsed to
one row, preventing alert fatigue from repeated incident updates or queue changes.

### 8. Mobile Coordinator Optimisation

**Mobile Triage View** (`MobileTriageView`) replaces the 3-column layout on small screens.
It generates a single ranked list of critical items from across all data sources:
- Safeguarding incidents → red cards with "Review" chevron
- Uncovered shifts → red cards with "Assign" chevron
- Expiring/expired compliance → amber cards
- Critical/urgent queue items → amber cards

Each card is a full-width `<Link>` with minimum 48px height for thumb targeting.
Active states use `active:scale-[0.99]` for tactile feedback.

Below the triage list, 4 quick-link buttons (2×2 grid, min-height 48px) give
thumb-friendly access to Handover, Briefing, Queue, Incidents.

---

## File Map

| File | Role |
|------|------|
| `lib/operations/workspaceMemory.ts` | localStorage helpers — focus mode, queue prefs, collapsed sections |
| `components/admin/OperationsControlCenter.tsx` | Main OCC with Focus Mode, collapsible sections, smart empty states, mobile triage |
| `components/admin/OperationsPriorityQueue.tsx` | Queue page with smart sort, workspace memory, inline quick actions |
| `lib/operations/priorityQueue.ts` | Shared types (unchanged) |

No new API routes, migrations, or server-side changes were required.
All intelligence systems (incident risk, compliance, scheduling, workforce) are preserved.

---

## Preserved Systems

- All intelligence APIs (`/incidents/intelligence`, `/incidents/staff-risk`, `/incidents/client-risk`)
- Compliance automation and risk scoring
- Incident risk engine
- Operations queue CRUD APIs
- Handover notes system
- RBAC — all permission checks unchanged
- Audit logging — all write operations still write to `audit_logs`
- Multi-tenant isolation

---

## UX Changes Summary

| Area | Before | After |
|------|--------|-------|
| OCC header | Just title + 2 nav buttons | Title + Focus Mode toggle + nav |
| KPI row | 8 cards always visible | 4 primary always; 4 secondary hidden in Focus Mode |
| Priority queue panel | Simple list, no inline actions | Smart-sorted list with inline ✓, View, Resolve, Assign |
| Feed | All events visible | Deduped; critical/high only in Focus Mode |
| Sections | Always visible, no collapse | Collapsible with memory; force-open when critical |
| Empty states | Generic "No items" | Operational guidance per section |
| Mobile layout | Stacked panels with scrolling | Triage list + 4 quick-link buttons |
| Queue page | Single filter state (lost on navigation) | Preferences persist across sessions |
| Sort | Created-at only | Smart priority, due-date, created-at; persisted |
