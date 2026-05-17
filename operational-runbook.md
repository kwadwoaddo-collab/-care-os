# Care OS Operational Runbook

**Date:** 2026-05-17  
**Audience:** On-call engineer, platform admin  
**Purpose:** Diagnose and resolve common operational issues in Care OS

---

## Quick Reference

| Issue | Go to |
|-------|-------|
| Cron job not running | § 1.1 |
| Job stuck in running state | § 1.2 |
| Job failing repeatedly | § 1.3 |
| Compliance sweep not updating staff | § 2.1 |
| No compliance reminder emails sent | § 2.2 |
| Visit anomaly scan missing anomalies | § 3.1 |
| Comms triggers flooding staff | § 3.2 |
| Health endpoint returning false | § 4.1 |
| Supabase connection failures | § 4.2 |
| Migration mismatch reported | § 4.3 |
| Staff can't log in (admin portal) | § 5.1 |
| Worker portal access broken | § 5.2 |

---

## 1. Background Jobs

### 1.1 Cron Job Not Running

**Symptoms:** No new `job_executions` rows for a job; compliance data not updating.

**Check Vercel Cron Logs:**
1. Vercel Dashboard → Project → Cron Jobs tab
2. Confirm the cron is listed and last triggered time is expected
3. Check if the deployment includes the updated `vercel.json`

**Verify cron route manually:**
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/compliance-sweep
```

Expected response: `{ "ok": true, ... }`

**Common causes:**
- `CRON_SECRET` env var not set → route returns `401`
- Deployment didn't include the cron route file
- `vercel.json` path mismatch (check the `"path"` field exactly matches the route file path)

**Resolution:**
1. Set `CRON_SECRET` in Vercel Environment Variables if missing
2. Redeploy after fixing env vars
3. Use "Run now" button at `/admin/system/jobs` for immediate execution

---

### 1.2 Job Stuck in Running State

**Symptoms:** Dashboard shows a job with status `running` for >15 min; `stuckJobCount > 0` in health check.

**Check stuck jobs:**
```sql
SELECT id, job_name, started_at, instance_id,
       EXTRACT(epoch FROM (now() - started_at)) / 60 AS running_minutes
FROM job_executions
WHERE status = 'running'
  AND started_at < now() - interval '15 minutes';
```

**Resolution:**
```sql
-- Mark as failed and release the lock
UPDATE job_executions
SET status = 'failed',
    completed_at = now(),
    error_message = 'Manually resolved — job was stuck'
WHERE status = 'running'
  AND started_at < now() - interval '15 minutes';

-- Release the corresponding locks
DELETE FROM job_locks
WHERE execution_id IN (
  SELECT id FROM job_executions
  WHERE status = 'failed'
    AND error_message = 'Manually resolved — job was stuck'
);
```

**Why jobs get stuck:**
- Vercel function timeout (default 10s on Hobby, 30s on Pro, 900s on Enterprise)
- Database connection pool exhausted — the function hung waiting for a connection
- Supabase rate limit hit mid-execution

---

### 1.3 Job Failing Repeatedly

**Symptoms:** `status = 'failed'` in `job_executions`; `error_message` in the row.

**Diagnose:**
```sql
SELECT job_name, error_message, error_detail, started_at
FROM job_executions
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 20;
```

**Check the Vercel Function Logs** for the full error trace:
- Vercel Dashboard → Deployments → Functions tab → filter by route name

**Retry from dashboard:**
1. Go to `/admin/system/jobs`
2. Find the failed execution in the Recent Executions table
3. Click "Retry"

**Retry via API:**
```bash
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_SESSION_TOKEN" \
  https://your-domain.vercel.app/api/admin/system/jobs/{execution_id}/retry
```

**If retries keep failing:**
- Review `error_detail` for the full stack trace
- Check if a database column referenced in the job no longer exists (schema drift)
- Check if a referenced table has RLS blocking the service role (shouldn't happen with `service_role` policies)

---

## 2. Compliance Jobs

### 2.1 Compliance Sweep Not Updating Staff

**Symptoms:** Staff compliance state shows stale data; `last_sweep_at` on `staff_profiles` is old.

**Check last sweep result:**
```sql
SELECT metadata, created_at
FROM audit_logs
WHERE action = 'compliance.sweep_result'
  AND entity_id = '{staff_id}'
ORDER BY created_at DESC
LIMIT 5;
```

**Force a manual sweep:**
1. Go to `/admin/system/jobs`
2. Click "Run now" on `compliance_sweep`

**Common cause:** The sweep ran but the `buildComplianceSnapshot` function returned an unexpected state. Check `error_message` on the execution row.

---

### 2.2 No Compliance Reminder Emails Sent

**Symptoms:** Compliance reminder job shows `success` but no emails received.

**Check if Resend is configured:**
```bash
curl -s https://your-domain.vercel.app/api/admin/system/health \
  | jq '.resendConfigured, .emailFromConfigured'
```

Both should return `true`.

**Check suppression records:**
```sql
SELECT * FROM message_suppression
WHERE company_id = '{company_id}'
  AND suppressed_until > now()
ORDER BY created_at DESC;
```

If suppression records exist, emails are being deduped intentionally. The compliance reminder job uses a 24h window.

**Check notification_logs:**
```sql
SELECT recipient_email, status, error_message, created_at
FROM notification_logs
WHERE created_at > now() - interval '24 hours'
  AND channel = 'email'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 3. Visit & Communication Jobs

### 3.1 Visit Anomaly Scan Missing Anomalies

**Symptoms:** Anomalies visible in visit records but not appearing in `/admin/visits/anomalies`.

**Check if the scan ran today:**
```sql
SELECT id, status, started_at, result
FROM job_executions
WHERE job_name = 'anomaly_scan'
ORDER BY started_at DESC
LIMIT 5;
```

**Check if anomalies already exist (idempotency check):**
```sql
SELECT anomaly_type, shift_id, resolved, created_at
FROM visit_anomalies
WHERE shift_id = '{shift_id}'
ORDER BY created_at DESC;
```

The scan skips creation if an unresolved anomaly of the same type already exists for the shift.

**Run scan for today manually:**
```bash
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobName":"anomaly_scan"}' \
  https://your-domain.vercel.app/api/admin/system/jobs
```

---

### 3.2 Comms Triggers Flooding Staff

**Symptoms:** Staff receiving repeated identical notifications.

**Check suppression records:**
```sql
SELECT suppress_key, suppressed_until, created_at
FROM message_suppression
WHERE company_id = '{company_id}'
ORDER BY created_at DESC;
```

**If suppression records are missing**, the job may have failed before writing them. Check:
```sql
SELECT error_message FROM job_executions
WHERE job_name = 'comms_triggers'
ORDER BY started_at DESC LIMIT 3;
```

**Emergency suppression — mute all triggers for a company for 48h:**
```sql
INSERT INTO message_suppression (company_id, suppress_key, suppressed_until)
VALUES
  ('{company_id}', 'emergency_mute', now() + interval '48 hours')
ON CONFLICT (company_id, suppress_key) DO UPDATE SET suppressed_until = EXCLUDED.suppressed_until;
```

Then update the `isSuppressed` check in `lib/communications/suppress.ts` to check for this key.

---

## 4. Platform Health

### 4.1 Health Endpoint Returning False

**Endpoint:** `/api/admin/system/health`

**For `database: false`:**
- Supabase project may be paused (free tier pauses after inactivity)
- `SUPABASE_SERVICE_ROLE_KEY` has been rotated without updating Vercel env vars
- Supabase is experiencing an outage — check https://status.supabase.com

**For `storage: false`:**
- Same as above; also check if the Storage service is enabled on the project

**For `cronSecretConfigured: false`:**
- Add `CRON_SECRET` to Vercel Environment Variables
- Value must be at least 8 characters; recommend 32+ random characters
- Redeploy after adding

**For `migrationsMismatch: true`:**
- See § 4.3

---

### 4.2 Supabase Connection Failures

**Common causes:**

| Symptom | Likely cause |
|---------|-------------|
| `invalid API key` error | Service role key rotated; update `SUPABASE_SERVICE_ROLE_KEY` in Vercel |
| `connection refused` | Supabase project paused; visit Supabase dashboard to resume |
| `too many requests` | Rate limit hit; queries per second exceeded |
| `SSL connection required` | DB URL missing `?sslmode=require` (usually auto-handled by Supabase SDK) |

**Check active connections:**
In Supabase Dashboard → Database → Connections tab.

**For rate limiting:** Ensure `adminClient` queries use `.select('id')` with `head: true` for count-only queries to reduce data transfer.

---

### 4.3 Migration Mismatch

**Symptom:** `health.migrationsMismatch === true`

This means the number of `.sql` files in `supabase/migrations/` doesn't match the rows in `schema_migrations`.

**Diagnose:**
```sql
SELECT version FROM schema_migrations ORDER BY version;
```

Compare against files in `supabase/migrations/`.

**Apply missing migrations:**
```bash
# Using Supabase CLI
supabase db push

# Or apply manually:
psql $DATABASE_URL -f supabase/migrations/050_job_orchestration.sql
```

**Note:** The health check uses a best-effort approach. The `schema_migrations` table may not exist on all deployments — a `null` value for `appliedMigrations` is expected if this table doesn't exist.

---

## 5. Authentication

### 5.1 Admin Can't Log In

**Symptoms:** `/admin/login` shows error or redirect loop.

**Check:**
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel
- The user's email exists in Supabase Auth (Dashboard → Authentication → Users)
- The user has a record in `companies` and an associated admin role

**Reset admin password via Supabase:**
Supabase Dashboard → Authentication → Users → find user → Send Reset Email

**Check `admin_users` or equivalent:**
```sql
SELECT id, email, role, company_id FROM admin_users WHERE email = '{email}';
```

---

### 5.2 Worker Portal Access Broken

**Symptoms:** Workers can't access `/worker/*`; magic links not working.

**Check:**
- `NEXT_PUBLIC_APP_URL` is set correctly — magic link emails include this base URL
- `RESEND_API_KEY` is configured for email delivery

**Test magic link generation:**
1. Go to `/admin/staff/{id}` → Resend Invite
2. Check `notification_logs` for email delivery status:
```sql
SELECT status, error_message FROM notification_logs
WHERE channel = 'email'
  AND metadata->>'type' = 'magic_link'
ORDER BY created_at DESC LIMIT 5;
```

---

## 6. Data Recovery

### 6.1 Accidentally Resolved Anomalies

```sql
-- Find recently resolved anomalies
SELECT id, anomaly_type, shift_id, resolved_at, resolved_by
FROM visit_anomalies
WHERE resolved = true
  AND resolved_at > now() - interval '1 hour'
ORDER BY resolved_at DESC;

-- Unresolve if needed
UPDATE visit_anomalies
SET resolved = false, resolved_at = null, resolved_by = null
WHERE id = '{anomaly_id}';
```

### 6.2 Duplicate Job Executions

If the same job appears twice with `status = 'running'`:
1. Check `job_locks` — only one lock should exist
2. If two locks exist, a race condition occurred before the unique constraint check
3. Manually fail the earlier execution:
```sql
UPDATE job_executions
SET status = 'failed', error_message = 'Duplicate execution — resolved manually'
WHERE id = '{older_execution_id}';

DELETE FROM job_locks WHERE execution_id = '{older_execution_id}';
```

---

## 7. Escalation Contacts

| Issue | Contact |
|-------|---------|
| Supabase outage | https://status.supabase.com |
| Vercel outage | https://www.vercel-status.com |
| Resend email delivery | https://status.resend.com |
| Code bug found | Create issue in project repo |
| Data integrity concern | Notify registered manager + escalate to CTO |
| Safeguarding data breach | Follow company safeguarding policy immediately |

---

## 8. Useful Queries

### Active job execution summary
```sql
SELECT 
  job_name,
  COUNT(*) FILTER (WHERE status = 'success') AS success,
  COUNT(*) FILTER (WHERE status = 'failed')  AS failed,
  COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
  ROUND(AVG(duration_ms) FILTER (WHERE status = 'success') / 1000.0, 1) AS avg_duration_sec,
  MAX(started_at) AS last_run
FROM job_executions
WHERE started_at > now() - interval '7 days'
GROUP BY job_name
ORDER BY job_name;
```

### Companies with compliance issues
```sql
SELECT c.name, 
       COUNT(sp.id) AS non_compliant_staff,
       AVG(sp.compliance_risk_score) AS avg_risk
FROM companies c
JOIN staff_profiles sp ON sp.company_id = c.id
WHERE sp.compliance_state IN ('non_compliant', 'blocked')
  AND sp.status IN ('active', 'pre_employment')
GROUP BY c.id, c.name
ORDER BY non_compliant_staff DESC;
```

### Jobs with high failure rates (last 30d)
```sql
SELECT job_name,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'failed') AS failures,
       ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 1) AS failure_pct
FROM job_executions
WHERE started_at > now() - interval '30 days'
  AND status IN ('success', 'failed')
GROUP BY job_name
HAVING COUNT(*) FILTER (WHERE status = 'failed') > 0
ORDER BY failure_pct DESC;
```
