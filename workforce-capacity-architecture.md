# Workforce Capacity & Staffing Readiness Architecture

## Overview

The Workforce Capacity Intelligence system turns Care OS from a compliance registry into an
operational workforce planning tool. It answers three core questions for coordinators:

1. **Who is deployable right now?**
2. **Where are the staffing pressure points?**
3. **What is about to break?**

---

## System Components

### 1. Readiness Engine — `lib/workforce/readinessEngine.ts`

Classifies every staff member into one of six operational states in strict priority order:

| State                  | Meaning                                                    |
|------------------------|------------------------------------------------------------|
| `deployable`           | Active, onboarding complete, fully compliant, no warnings  |
| `deployable_with_risk` | Active, onboarding complete, compliance warnings present   |
| `non_deployable`       | Active, onboarding complete, compliance blocked            |
| `onboarding_incomplete`| Pre-employment or active with onboarding unfinished        |
| `suspended`            | Staff suspended by admin                                   |
| `inactive`             | Terminated or permanently inactive                         |

**Classification factors:**
- `status` column on `staff_profiles`
- `onboarding_completed` flag
- Compliance state: `compliant` | `warning` | `non_compliant` | `blocked` (from `calculateCompliance`)
- DBS and Right-to-Work check flags
- Availability presence (at least one available day)
- Active override (admin bypass — promotes to `deployable_with_risk`)

**Priority:** Higher states (inactive > suspended) cannot be overridden by lower factors.

---

### 2. Deployability Score — `lib/workforce/deployabilityScore.ts`

A 0–100 operational readiness score derived from multiple weighted factors:

| Factor                        | Max deduction | Notes                                  |
|-------------------------------|---------------|----------------------------------------|
| Compliance gap                | -40           | `(100 - compliance%) × 0.4`            |
| Onboarding incomplete         | -30           | `(100 - onboarding%) × 0.3`            |
| DBS not checked               | -10           |                                        |
| Right to work not checked     | -10           |                                        |
| No availability configured    | -5            |                                        |
| Open/investigating incidents  | -15 (max)     | `-5` per incident                      |
| Expiring compliance items     | -10 (max)     | `-3` per item expiring within 14 days  |
| Declined shifts (last 30d)    | -10 (max)     | `-3` per 3 declines                    |

**Score tiers:** `high ≥ 80`, `medium ≥ 60`, `low ≥ 30`, `critical < 30`

Status shortcuts:
- `terminated` / `inactive` → always 0
- `suspended` → always 5
- `pre_employment` → `onboardingProgress × 0.3`

---

### 3. Operational Feed — `lib/workforce/operationalFeed.ts`

Generates proactive coordinator alerts sorted by severity (critical → warning → info):

| Alert                          | Level    | Trigger condition                          |
|-------------------------------|----------|--------------------------------------------|
| Uncovered shifts (14 days)    | critical if >5, else warning | Shifts with no assigned worker |
| Staff blocked from shifts     | critical | `non_deployable` count > 0                |
| Imminent compliance expiry    | warning  | Staff losing status within 14 days        |
| Expiry pressure (30 days)     | info     | Additional staff expiring in 30 days      |
| Stalled onboarding            | warning  | In-progress for 7+ days with no change    |
| Pending cert approvals        | info     | Training certs awaiting admin review      |
| Role shortages                | critical/warning | Deployable count < threshold per role |
| Expiry clusters by role       | warning  | ≥3 staff in same role expiring in 30 days |

---

### 4. Capacity API — `app/api/admin/workforce/capacity/route.ts`

```
GET /api/admin/workforce/capacity
```

**Parallel queries:**
- `staff_profiles` — all non-terminated staff with onboarding fields
- `documents` — all docs for compliance calculation
- `staff_availability` — availability presence check
- `incidents` — open/investigating incidents (for score deduction)
- `shifts` (next 14 days) — coverage gap detection
- `shifts` (last 30 days declined) — attendance pattern
- `documents` — pending cert count

**Response shape:**
```typescript
{
  summary:       CapacitySummary        // aggregate state counts
  staff:         StaffReadinessRow[]    // individual readiness rows (sorted by score asc)
  byRole:        RoleCapacity[]         // deployable/at-risk/blocked counts per role
  expiryCluster: ExpiryCluster[]        // doc types expiring in 7/14/30 days
  coverage:      { uncoveredNext14d, understaffedDays[] }
  onboarding:    OnboardingBottlenecks  // stalls, missing docs, pending approvals
  feed:          FeedAlert[]            // sorted operational alerts
  asOf:          string                 // ISO timestamp
}
```

---

### 5. Capacity Dashboard — `app/admin/workforce/capacity/`

A five-tab dashboard rendered as a server-side page with client-side interactivity:

| Tab          | Content                                                       |
|--------------|---------------------------------------------------------------|
| **Overview** | Summary stat grid, state distribution bar, operational feed, expiry clusters |
| **Staff**    | Searchable/filterable table of all staff with state, score, compliance %, issues |
| **By Role**  | Role table with deployable/at-risk/blocked counts and capacity bar |
| **Coverage** | Unassigned shifts count, understaffed days table with links to fill |
| **Onboarding** | Bottleneck metrics: stalled, missing docs, pending approvals, avg stalled days |

**Refresh:** Client-side refresh button re-fetches `/api/admin/workforce/capacity` without full page reload.

---

## Data Flow

```
staff_profiles ──┐
documents       ──┤
staff_availability──┤ → buildComplianceSnapshot()  ──┐
incidents       ──┤ → classifyDeployability()      ──┤ → CapacityResponse
shifts (future) ──┤ → calculateDeployabilityScore()─┤
shifts (past)   ──┘ → generateOperationalFeed()    ──┘
```

---

## Integration with Existing Systems

### Preserved systems (unchanged)
- **Compliance engine** (`lib/compliance/`) — `buildComplianceSnapshot` is called by the readiness engine
- **Escalation engine** (`lib/compliance/escalation.ts`) — unchanged, operates independently
- **Override system** — `activeOverride` flag is accepted by `classifyDeployability`
- **RBAC permissions** — page requires `canManageStaff(role)`, API requires `requireAdmin()`
- **Audit logging** — no write operations in this system; all reads only

### Shift assignment integration
Before assigning a shift, coordinators can:
1. View the staff member's deployability state and score in the Staff tab
2. See blockers and warnings before assignment
3. Navigate directly from understaffed days to the open shifts queue

---

## Access Control

| Route                                | Permission required        |
|--------------------------------------|----------------------------|
| `/admin/workforce/capacity`          | `canManageStaff(role)`     |
| `GET /api/admin/workforce/capacity`  | `requireAdmin()` (any role)|

Roles that can manage staff: `admin`, `super_admin`, `manager`, `hr` (per `lib/rbac/can.ts`).

---

## Performance Notes

- All data for the capacity page is fetched in a single Promise.all with 8 parallel queries.
- The page is server-rendered for instant first paint; the refresh button uses the API endpoint.
- No realtime subscriptions — this is a snapshot-at-load-time view, refreshed on demand.
- For large companies (200+ staff), the compliance calculation loop is O(n × docs_per_staff).
  At typical care company scale (20–100 staff) this completes in < 500ms.

---

## Future Enhancements (not yet built)

1. **Readiness timeline** — track deployability gained/lost over time (requires audit log writes)
2. **Shift assignment widget** — show deployability inline in the assign shift modal
3. **Overtime warnings** — flag workers approaching max_weekly_hours before assignment
4. **Predictive shortages** — forecast staffing pressure from care package demand
5. **Capacity export** — CSV export of workforce capacity snapshot for management reporting
