# Infrastructure Reliability & Background Job Orchestration

**Date:** 2026-05-17  
**Status:** Production  
**Scope:** Background job framework, distributed locking, job monitoring, cron orchestration, health checks, resilience patterns

---

## Overview

Care OS operates a scheduled background job system that runs compliance sweeps, communication triggers, visit anomaly detection, and safeguarding escalation scans daily. This document describes the architecture of that system, its reliability guarantees, and operational patterns.

---

## 1. Background Job Framework

### 1.1 Core Components

| File | Role |
|------|------|
| `lib/jobs/types.ts` | Shared type definitions: `JobStatus`, `JobTrigger`, `JobDefinition`, `JobResult`, `JobContext`, `JobExecutionRow` |
| `lib/jobs/registry.ts` | Central registry of all scheduled jobs (`JOB_REGISTRY`), with metadata: schedule, timeouts, retries, scope |
| `lib/jobs/executor.ts` | Core execution engine: locking, execution tracking, metrics, retry detection, stuck job detection |

### 1.2 Execution Flow

```
Cron trigger (Vercel)
  → cron route (isCronAuthorized guard)
  → executeJob(opts, fn)
      → INSERT job_executions (status='running')
      → acquireLock (INSERT job_locks, detect duplicate via 23505)
        ├─ locked? → UPDATE job_executions (status='skipped'), return
        └─ got lock → fn(ctx) runs
            ├─ success → UPDATE job_executions (status='success')
            ├─ failure → UPDATE job_executions (status='failed', error_message)
            └─ finally → DELETE job_locks
      → recordMetric(job.duration.{name}, durationMs)
```

### 1.3 Idempotency and Deduplication

- Every job acquires a named lock before running: `lock_key = '{job_name}:system'`
- Lock TTL defaults to 5–10 minutes per job (configurable in registry)
- If two Vercel instances attempt the same cron simultaneously, the second receives a `23505` unique constraint violation and gracefully returns `{ ok: true, skipped: true }`
- Expired locks are cleaned up before each lock attempt — no cron job can be stuck locked indefinitely

### 1.4 Retry Semantics

- Each job has a `maxRetries` count (default: 3) stored with the execution record
- `canRetry(execId)` checks `status === 'failed' && retry_count < max_retries`
- Retries can be triggered manually from the `/admin/system/jobs` dashboard or via the retry API endpoint
- Each retry creates a new `job_executions` row (not a mutation of the original)

---

## 2. Scheduled Jobs

| Job | Schedule | Description | Lock TTL | Timeout |
|-----|----------|-------------|----------|---------|
| `compliance_sweep` | Daily 06:00 UTC | Recalculates compliance states, risk scores, sends in-app expiry notifications | 10 min | 8 min |
| `compliance_reminders` | Daily 07:00 UTC | Email digest of compliance issues to company admins | 10 min | 8 min |
| `anomaly_scan` | Daily 08:00 UTC | Scans for visit anomalies (late, short, no-show, medication) | 5 min | 4 min |
| `comms_triggers` | Daily 09:00 UTC | Fires smart messaging triggers (expiry, stall, coverage, safeguarding) | 8 min | 6 min |
| `escalation_scan` | Daily 10:00 UTC | Reviews SLA breaches on incidents and compliance overrides | 5 min | 4 min |

### Cron Configuration (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/compliance-sweep",    "schedule": "0 6 * * *" },
    { "path": "/api/cron/compliance-reminders","schedule": "0 7 * * *" },
    { "path": "/api/cron/anomaly-scan",        "schedule": "0 8 * * *" },
    { "path": "/api/cron/comms-triggers",      "schedule": "0 9 * * *" },
    { "path": "/api/cron/escalation-scan",     "schedule": "0 10 * * *" }
  ]
}
```

---

## 3. Database Tables

### `job_executions`

Records every job invocation with full lifecycle tracking.

```sql
id              UUID PK
job_name        TEXT NOT NULL
company_id      UUID (nullable — system-scoped jobs have no company)
status          TEXT ('running'|'success'|'failed'|'retrying'|'cancelled'|'skipped')
started_at      TIMESTAMPTZ
completed_at    TIMESTAMPTZ
duration_ms     INT
retry_count     INT DEFAULT 0
max_retries     INT DEFAULT 3
parent_id       UUID (FK to job_executions — for retry chains)
error_message   TEXT
error_detail    TEXT (full stack trace)
result          JSONB
triggered_by    TEXT ('cron'|'manual'|'retry'|'system')
instance_id     TEXT (Vercel instance or hostname)
```

**Indexes:**
- `(job_name, started_at DESC)` — fast per-job history
- `(status)` — monitoring queries
- `(status) WHERE status = 'running'` — stuck job detection

### `job_locks`

Distributed mutex preventing duplicate concurrent runs.

```sql
lock_key        TEXT PK   -- '{job_name}:{company_id|system}'
execution_id    UUID FK (job_executions)
locked_at       TIMESTAMPTZ
expires_at      TIMESTAMPTZ
instance_id     TEXT
```

**Pattern:** `INSERT` — if `23505` unique violation, another instance holds the lock. Lock is released on job completion via `DELETE`. Expired locks are auto-cleaned before each new lock attempt.

### `system_metrics`

Lightweight time-series for job performance.

```sql
id           UUID PK
company_id   UUID (nullable)
metric_name  TEXT   -- e.g. 'job.duration.compliance_sweep'
metric_value NUMERIC
tags         JSONB  -- { status: 'success'|'failed' }
recorded_at  TIMESTAMPTZ
```

**Retention:** 30 days (enforced at write time — old rows deleted before insert).

---

## 4. Job Monitoring Dashboard

**Route:** `/admin/system/jobs`  
**Permission required:** `system:read`

### Features

- **Registered jobs panel**: Shows each job's name, description, schedule, last execution time, duration, and 7-day success rate.
- **Today's stats**: Total executions, successes, failures, skips.
- **Stuck job alert**: Automatic detection of jobs stuck in `running` state for >15 minutes.
- **Manual trigger**: Any enabled job can be triggered from the dashboard without waiting for the scheduled time (requires `system:write`).
- **Execution history**: Last 100 executions with status, duration, trigger source, and error message.
- **Retry button**: One-click retry for failed executions that have retry budget remaining.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/system/jobs` | List all jobs + recent executions + stats |
| `POST` | `/api/admin/system/jobs` | Manually trigger a job by name |
| `POST` | `/api/admin/system/jobs/[id]/retry` | Retry a specific failed execution |

---

## 5. Health Checks Expansion

The `/api/admin/system/health` endpoint now includes job and operational health signals:

| Field | Description | Alert threshold |
|-------|-------------|-----------------|
| `stuckJobCount` | Jobs stuck in `running` for >15 min | > 0 |
| `recentFailedJobCount` | Failed jobs in last 24h | > 2 |
| `openAnomalyCount` | Unresolved visit anomalies | > 10 |
| `staleIncidentCount` | Open incidents with no update in >7 days | > 0 |

---

## 6. Resilience Patterns

### 6.1 Authorization Guard

All cron routes use `isCronAuthorized(request)` which checks:

```typescript
const auth = request.headers.get('authorization')
return auth === `Bearer ${process.env.CRON_SECRET}`
```

Routes return `401` immediately if `CRON_SECRET` is not set or the header doesn't match. Vercel's cron runner automatically provides the secret.

### 6.2 Multi-Tenant Isolation

- All company-scoped operations iterate over `companies` table — no cross-tenant data access.
- `system_metrics` and `job_executions` use `company_id = null` for system-level jobs.
- RLS policies on job tables restrict access to `service_role` only.

### 6.3 Partial Failure Handling

- Company-level errors within a job are caught and counted but do not abort the entire run.
- Per-staff errors within company sweeps are similarly isolated.
- `result.errors` in the job payload tracks partial failure count.
- A job returns `ok: false` only if the error count is greater than zero — but the execution still completes.

### 6.4 Communication Suppression

`comms_triggers` uses the `message_suppression` table to avoid flooding staff and admins:

| Trigger type | Suppression window |
|--------------|-------------------|
| Compliance expiry warning | 24 hours |
| Onboarding stall | 48 hours |
| Uncovered shift coverage | 12 hours |
| Safeguarding escalation reminder | 24 hours |

### 6.5 Audit Logging

All escalations and SLA breach notifications are written to `audit_logs` with:
- `action: 'compliance.escalation'` / `'incident.sla_escalation'` / `'compliance.override_reminder'`
- `metadata` including escalation level, days open, and missing items

The `audit_logs` entries serve as deduplication anchors — a 24h lookback prevents repeat notifications.

### 6.6 Fire-and-Forget Notifications

In-app notifications created within cron jobs use `void createNotification(...)` — notification failures are non-blocking and do not fail the job.

---

## 7. Anomaly Detection

`anomaly-scan` detects four visit anomaly types per company:

| Type | Condition | Severity |
|------|-----------|----------|
| `late_arrival` | Check-in ≥15 min after scheduled start | high (≥45 min), medium (<45 min) |
| `short_visit` | Actual duration <80% of scheduled | high (<50%), medium (<80%) |
| `no_show` | Shift start >30 min ago, no timesheet entry | high |
| `medication_concern` | Medication record with `outcome = 'refused'` | high |

Anomalies are idempotent — duplicate detection for the same shift + type is suppressed via a `(company_id, shift_id, anomaly_type, resolved=false)` uniqueness check.

---

## 8. Security Posture

| Control | Implementation |
|---------|---------------|
| Cron authentication | `CRON_SECRET` in Authorization header — routes deny all if unset |
| Service role isolation | `adminClient` only in `server-only` modules |
| Admin route guards | All `/api/admin/system/*` routes call `requireAdmin()` + `can(role, 'system:*')` |
| RLS | `job_executions`, `job_locks`, `system_metrics` — `service_role` only policies |
| Tenant isolation | All company-scoped queries include `company_id` filter |
| Manual trigger safety | Requires `system:write` permission; re-uses the cron route with the CRON_SECRET internally |

---

## 9. Observability

### Metrics written per job run

```
job.duration.{job_name}   → duration_ms, tags: { status: 'success'|'failed' }
```

Stored in `system_metrics` with 30-day retention.

### Structured logs

All cron routes use `console.info` / `console.error` with structured objects. On Vercel, these appear in the Function Logs with:
- `[executor] job complete` — normal completion
- `[executor] job threw` — unhandled exception
- `[executor] job skipped — lock held` — deduplication event
- `[anomaly-scan]` / `[escalation-scan]` / `[comms-triggers]` — per-route prefixes

---

## 10. Deployment Checklist

Before deploying to a new environment:

- [ ] `CRON_SECRET` env var set (min 16 chars)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server-only)
- [ ] Migration `050_job_orchestration.sql` applied to the target database
- [ ] Vercel project has Cron Jobs feature enabled
- [ ] `NEXT_PUBLIC_APP_URL` set to the deployment URL (used in notification action links)
- [ ] Test cron route manually: `curl -H "Authorization: Bearer {CRON_SECRET}" https://your-domain/api/cron/compliance-sweep`
