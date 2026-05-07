# Production Monitoring — Care OS

Practical, lightweight monitoring recommendations for a first production deployment.
Add tooling incrementally as traffic grows.

---

## Uptime monitoring

**Recommended**: [Betterstack Uptime](https://betterstack.com/uptime) (free tier) or [UptimeRobot](https://uptimerobot.com).

Set up HTTP monitors on:

| URL | Check interval | Alert on |
|---|---|---|
| `https://your-domain.com/admin/login` | 1 min | Status ≠ 200 |
| `https://your-domain.com/api/admin/system/health` | 5 min | Status ≠ 200 or `database: false` |

The `/api/admin/system/health` endpoint returns a JSON health object:
```json
{
  "database": true,
  "storage": true,
  "resendConfigured": true,
  "appUrlConfigured": true,
  "authSession": false,
  "timestamp": "2026-05-01T12:00:00Z"
}
```

Alert if `database` or `storage` flips to `false`.

---

## Error tracking

**Recommended**: [Sentry](https://sentry.io) (generous free tier).

### Setup
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### What to capture
- All uncaught errors in Server Components (Next.js `error.tsx` currently logs via `console.error`)
- API route 5xx responses
- Auth failures that exceed a threshold

### Quick wins without Sentry
The built-in `app/admin/error.tsx` exposes an `error.digest` (a short opaque ID Next.js assigns).
Collect these IDs from server logs to correlate user reports with log entries.

---

## Log aggregation

Vercel Functions emit logs accessible in the Vercel dashboard (Functions tab).
For persistent aggregation, pipe logs to an external service.

**Recommended**: [Axiom](https://axiom.co) (Vercel integration, free tier) or [Logtail](https://betterstack.com/logtail).

### Vercel + Axiom setup
1. Install the Axiom Vercel integration
2. Logs automatically stream to Axiom
3. Create a dashboard filtering on `[error]` and `[warn]` log lines

### Key log patterns to alert on
```
[error]      # Any server-side error
[requireAdmin] unexpected error
[rateLimit]  # When rate limits are hit
```

`lib/logger.ts` emits structured JSON-compatible log lines in production.

---

## Supabase monitoring

Access at: Supabase Dashboard → Reports

| Metric | Alert threshold |
|---|---|
| Database connections | > 80% of connection limit |
| Query response time (p95) | > 2,000 ms |
| Auth requests | Spike > 5× baseline |
| Storage usage | > 80% of plan limit |
| Realtime connections | N/A (not used) |

### Row count baselines (after QA seed)
Check these tables in Supabase → Table Editor weekly:

| Table | Expected growth |
|---|---|
| `audit_logs` | High — every admin action |
| `notification_logs` | Medium — daily digest + shift reminders |
| `shifts` | Medium — new shifts weekly |
| `timesheets` | Medium — one per completed shift |

### Enable Supabase email alerts
Dashboard → Project Settings → Billing Alerts → Database size.

---

## Storage monitoring

| Bucket | Expected content | Alert if |
|---|---|---|
| `care-os-documents` | Staff documents (DBS, RTW, contracts) | Approaching plan storage limit |

Review uploaded files weekly in Supabase → Storage → `care-os-documents`.
Implement a periodic audit to detect orphaned storage objects (files without DB records).

---

## Backup considerations

### Database
Supabase automatically takes daily backups on Pro+ plans.  
For the free tier, schedule a weekly export:
```bash
pg_dump "$(supabase db url)" > backup-$(date +%Y%m%d).sql
```

### Storage
Files in Supabase Storage are not backed up separately on the free tier.
On Pro tier, enable Point-in-Time Recovery.

### Application
All application code is in Git — the repo IS the backup.
Vercel deployments are immutable; rollback is instant.

---

## Performance baselines

After first week in production, establish baselines for:

| Metric | Source | Tool |
|---|---|---|
| Page load time (p95) | Vercel Analytics | Enable in Vercel dashboard |
| API response time | Vercel Function logs | Axiom / Logtail |
| Supabase query time | Supabase Reports | Supabase dashboard |

Target: admin pages < 1,500 ms p95, API routes < 500 ms p95.

---

## Alerting quick-start checklist

- [ ] Uptime monitor on `/api/admin/system/health`
- [ ] Uptime monitor on `/admin/login`
- [ ] Supabase database size alert enabled
- [ ] Log drain configured (Vercel → Axiom or Logtail)
- [ ] On-call escalation path documented for the team
