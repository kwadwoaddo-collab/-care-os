# Executive Analytics & Operational Intelligence — Architecture

## Overview

The Executive Analytics layer provides leadership, directors, and registered managers with a composite view of operational health, predictive risk signals, and trend analytics across all domains of care delivery. It aggregates data from 12+ existing tables into structured analytical outputs without requiring any new database migrations.

---

## Design Principles

1. **Zero new migrations** — all analytics are computed from existing tables at query time. No pre-aggregated views or materialized tables required.
2. **Application-layer bucketing** — trend data is fetched as raw rows then bucketed into day/week/month periods in Node.js. Simple and tenant-safe.
3. **Composite health scoring** — the operational health score weights five dimensions into a 0-100 index with human-readable labels.
4. **Rule-based signals** — predictive signals compare current vs previous period using simple pct-change thresholds. No ML required.
5. **Print-first reporting** — the executive report page uses `window.print()` and pure CSS print styles for PDF generation. No external libraries.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              /admin/analytics (Executive Dashboard)          │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ Health Score │  │ Signals  │  │ 12 KPI cards           │ │
│  │   Gauge      │  │ Feed     │  │ + score breakdown      │ │
│  └──────────────┘  └──────────┘  └────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 6 Trend Charts (sparkline + bar chart, 7d/30d/90d/12m)  ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────────┘
                      │
     ┌────────────────┼────────────────┬────────────────┐
     ▼                ▼                ▼                ▼
/analytics/      /analytics/      /analytics/    /analytics/
workforce        safeguarding     reports        (all sub-pages)
                                  (print-ready)
     │                │                │
     ▼                ▼                ▼
/api/admin/analytics/*
  route.ts          — Main dashboard (health score + KPIs + signals)
  trends/           — Time-series bucketing (7d/30d/90d/12m)
  workforce/        — Attendance, deployability, onboarding
  safeguarding/     — Incident analytics, risk clusters
  operational/      — Queue, handover, comms, anomalies, medication
  signals/          — Predictive signals only (lightweight)
  export/           — Full bundle for reports page

     │
     ▼
lib/analytics/compute.ts
  bucketByPeriod()      — Timestamp → TrendPoint[] bucketing
  computeHealthScore()  — 5-dimension health index (0-100)
  detectSignals()       — Rule-based predictive signals
  splitHalves()         — Current vs previous period comparison
  pctChange()           — % change with zero handling
```

---

## Data Sources

| Metric | Table | Window |
|--------|-------|--------|
| Active staff | `staff_profiles` | Current snapshot |
| Compliance rate | `documents` | Expiry vs active staff |
| Open incidents | `incidents` | Rolling |
| Safeguarding clusters | `incidents` | 90 days |
| Shift fulfillment | `shifts` | 30 days |
| Missed visits | `visit_notes.is_missed` | 30 days |
| Medication incidents | `visit_medication_records` | 30 days |
| Late arrivals | `timesheets.lateness_minutes` | 30 days |
| Onboarding backlog | `staff_profiles.status=pre_employment` | >30 days |
| Queue efficiency | `operations_queue` | 30 days |
| Handover completion | `handover_notes` | 30 days |
| Communication ack | `message_recipients` | 30 days |
| Visit anomalies | `visit_anomalies` | Rolling |
| Applicant pipeline | `applicants` | Active statuses |

---

## Operational Health Score (0–100)

Weighted composite of five dimensions:

| Dimension | Weight | Formula |
|-----------|--------|---------|
| Compliance health | 0–25 pts | `(compliant_staff / active_staff) × 25` |
| Workforce readiness | 0–25 pts | `(deployable / total_staff) × 25` |
| Incident pressure | 0–20 pts | `20 - min(20, critical×5 + high×2)` |
| Visit quality | 0–20 pts | `(completion_rate / 100) × 20` |
| Onboarding flow | 0–10 pts | `max(0, 10 - min(10, backlog × 2))` |

**Score labels:**
- 80–100: **Good** (emerald)
- 60–79:  **Moderate** (amber)
- 40–59:  **At Risk** (orange)
- 0–39:   **Critical** (red)

---

## Trend Bucketing

`bucketByPeriod(timestamps, period)` takes an array of ISO timestamps and returns `TrendPoint[]`:

| Period | Buckets | Granularity |
|--------|---------|-------------|
| `7d`   | 7 points | Daily |
| `30d`  | 4 points | Weekly |
| `90d`  | 6 points | Bi-weekly |
| `12m`  | 12 points | Monthly |

This is computed in Node.js from raw rows — no `GROUP BY date_trunc` needed.

---

## Predictive Signals

`detectSignals(inputs)` compares current vs previous half of the window using `splitHalves()`:

| Signal | Trigger | Type |
|--------|---------|------|
| Incidents rising | ≥20% increase current vs previous | warning/critical |
| Missed visits rising | ≥20% increase | warning/critical |
| Medication incidents rising | ≥15% increase | critical |
| Onboarding backlog | ≥3 workers in pre_employment >30d | warning/critical |
| Compliance expiring | ≥5 items expiring in 30 days | warning |
| Night shift gap | ≥3 uncovered night/sleep-in shifts | warning |
| Visit anomalies backlog | ≥5 unresolved anomalies | warning |

Signals are sorted: critical first, then warning, then info.

---

## KPI Intelligence (12 metrics)

| KPI | Measurement |
|-----|-------------|
| Total Active Staff | Count of `staff_profiles.status='active'` |
| Compliance Rate | Active staff without expired docs / total active |
| Open Incidents | Count `incidents.status IN (open, investigating)` |
| Critical Incidents | Count `incidents.severity='critical' AND open` |
| Missed Visits (30d) | Count `visit_notes.is_missed=TRUE` last 30 days |
| Shift Fulfillment Rate | `completed / (completed + missed)` last 30 days |
| Avg Onboarding Days | Mean time from created_at to hired for applicants |
| Medication Incidents (30d) | `visit_medication_records.requires_escalation=TRUE` |
| Expiring Compliance (30d) | Docs with expiry_date in next 30 days |
| Onboarding Backlog | pre_employment > 30 days old |
| Total Applicants | Active applicants (applied/shortlisted/interview) |
| Deployable Staff | Active staff (simplified; deep check via workforce engine) |

---

## Workforce Performance Analytics (`/admin/analytics/workforce`)

- **Headcount**: active, pre_employment, suspended, terminated (30d), total
- **Attendance**: completed shifts, missed shifts, miss rate %, late arrivals count, avg lateness
- **Overtime**: staff working >40h/week (weekly avg proxy), avg weekly hours
- **Deployability**: deployable/at_risk/blocked counts + deployable %
- **Onboarding**: in progress, backlog >30d, completed 30d, avg days to active
- **Top missed staff**: ranked by missed shift count with links to staff profiles

---

## Safeguarding Analytics (`/admin/analytics/safeguarding`)

- **Summary**: total 90d, open, critical open, escalation rate %, avg resolution days, SLA breaches (>5 days)
- **Type breakdown**: incident types with count + % bar chart
- **Severity distribution**: severity counts
- **Trend**: incident frequency over selected period (sparkline + bar)
- **Escalation trend**: escalated-only trend overlay
- **High-risk clients**: clients with ≥2 incidents in 90 days (clustered)
- **High-risk workers**: workers linked to ≥2 incidents

**SLA alert**: shown prominently when any incident is open >5 days

---

## Operational Efficiency Metrics (`/api/admin/analytics/operational`)

- **Queue**: open count, resolved 30d, avg resolution hours, critical open, backlog >7d
- **Handover**: total 30d, reviewed, completion rate %, avg items per note
- **Communications**: messages 30d, auto-generated, ack rate %, failed deliveries
- **Visit anomalies**: unresolved total, critical unresolved, late arrivals, short visits, no-shows
- **Medication**: records 30d, refused, missed, escalated, escalation rate %

---

## Executive Report (`/admin/analytics/reports`)

A print-ready HTML page that bundles:
1. Company header + generation timestamp
2. Operational health score gauge (text representation)
3. KPI table with amber highlighting for thresholds breached
4. Predictive signals with colour coding
5. Incident breakdown table (90 days)

**Export formats:**
- **Print / PDF**: `window.print()` with `print:` Tailwind variants that hide UI chrome
- **JSON download**: Full data bundle as `care-os-report-YYYY-MM-DD.json`

No external PDF libraries. The print CSS produces clean A4 output through the browser's built-in PDF printer.

---

## RBAC

| Route | Required Permission |
|-------|-------------------|
| `/api/admin/analytics` | `compliance:read` |
| `/api/admin/analytics/trends` | `compliance:read` |
| `/api/admin/analytics/workforce` | `staff:read` |
| `/api/admin/analytics/safeguarding` | `safeguarding:read` |
| `/api/admin/analytics/operational` | `incidents:read` |
| `/api/admin/analytics/signals` | `compliance:read` |
| `/api/admin/analytics/export` | `compliance:read` |

Roles with `compliance:read`: `compliance_manager`, `registered_manager`, `company_admin`, `super_admin`.
Roles with `safeguarding:read`: `registered_manager`, `company_admin`, `super_admin`.

---

## Sidebar Integration

- **Analytics** added to footer nav (compliance:read and above)
- **Mobile nav More drawer**: Analytics added for compliance:read+ roles

---

## File Map

```
lib/analytics/
  compute.ts              — Pure functions: bucketing, health score, signals

app/api/admin/analytics/
  route.ts                — Main dashboard: health score + KPIs + signals
  trends/route.ts         — Time-series data (7d/30d/90d/12m)
  workforce/route.ts      — Workforce performance analytics
  safeguarding/route.ts   — Safeguarding analytics + risk clusters
  operational/route.ts    — Queue, handover, comms, anomalies, meds
  signals/route.ts        — Predictive signals only (lightweight)
  export/route.ts         — Full bundle for reports

app/admin/analytics/
  page.tsx                — Executive dashboard (health gauge + sparklines + KPIs)
  workforce/page.tsx      — Workforce performance deep-dive
  safeguarding/page.tsx   — Safeguarding analytics + SLA alerts
  reports/page.tsx        — Printable executive report + JSON export
```
