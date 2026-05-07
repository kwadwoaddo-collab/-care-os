# Deployment Checklist — Care OS

Run through this list for every production deployment.  
Items marked 🔴 are blockers. Items marked 🟡 are strongly recommended.

---

## Pre-deployment — one-time setup

Complete these once before the very first deployment.

### Supabase

- [ ] 🔴 Project created (not on localhost, not the QA dev project)
- [ ] 🔴 All migrations applied in order (`supabase/migrations/*.sql`)
- [ ] 🔴 Row-Level Security enabled on all tables (verify in Table Editor)
- [ ] 🔴 Storage bucket `care-os-documents` created with appropriate policies
- [ ] 🟡 Supabase Auth → Site URL set to `https://your-domain.com`
- [ ] 🟡 Supabase Auth → Redirect URLs include `https://your-domain.com/**`
- [ ] 🟡 Auth rate limiting reviewed (Supabase → Auth Settings)
- [ ] 🟡 Database connection pooling enabled (Supabase → Settings → Database)

### Domain & HTTPS

- [ ] 🔴 Custom domain configured in Vercel → Settings → Domains
- [ ] 🔴 HTTPS certificate auto-provisioned by Vercel (usually automatic)
- [ ] 🟡 `www` redirect to apex domain (or vice versa) configured
- [ ] 🟡 DNS TTL lowered 24h before deployment (for faster rollback)

### Resend (email)

- [ ] 🔴 Domain verified in Resend dashboard
- [ ] 🔴 SPF, DKIM, DMARC records added to DNS
- [ ] 🟡 Test email sent from the production `INVITE_FROM_EMAIL` address

---

## Environment variables

Configure in: Vercel → Project → Settings → Environment Variables.

| Variable | Environment | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Prod Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Prod service role key (mark sensitive) |
| `NEXT_PUBLIC_APP_URL` | Production | `https://your-domain.com` |
| `RESEND_API_KEY` | Production | Prod Resend API key |
| `INVITE_FROM_EMAIL` | Production | `noreply@yourdomain.com` |
| `NEXT_PUBLIC_BUILD_TIME` | Production | Set automatically via build command |

**Never set these in production:**
- `QA_BYPASS_AUTH` — must not exist in Vercel env vars
- `QA_EMAIL_MODE` — scripts-only

**Build command** (sets build time automatically):
```
NEXT_PUBLIC_BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) next build
```

---

## Database migrations

Before every deployment that includes schema changes:

```bash
# 1. Verify migration files are in order
ls supabase/migrations/

# 2. Review the new migration SQL manually
cat supabase/migrations/NNN_description.sql

# 3. Apply to production Supabase
supabase db push --db-url "postgresql://..."

# 4. Verify no errors in Supabase → Logs → Postgres
```

**Rules:**
- Never run QA seed scripts (`scripts/seed-qa-environment.ts`) against production
- Never run reset scripts against production
- Never apply migrations manually — always use migration files

---

## Staging smoke-test

Run this against any Vercel Preview URL or the staging environment before merging to production:

```bash
# Set the preview/staging URL (no trailing slash)
export BASE_URL=https://your-preview-url.vercel.app

# Run smoke tests (chromium + auth-tests projects only — fast, no webServer needed)
npm run qa:smoke:staging

# Equivalent long-form if you need more control:
BASE_URL=https://your-preview-url.vercel.app npm run qa:smoke:staging

# Or using the raw playwright command:
PLAYWRIGHT_BASE_URL=https://your-preview-url.vercel.app \
  npx playwright test tests/smoke/ --project=chromium --project=auth-tests
```

**What `qa:smoke:staging` validates:**
- Auth: QA admin / coordinator / worker can log in
- Invalid credentials are rejected at the login page
- `/admin` dashboard renders without errors
- `/admin/clients`, `/admin/staff` list views load
- `/admin/incidents`, `/admin/shifts` list views load
- Document upload UI is accessible

> **Prerequisites for staging auth tests to pass:**
> 1. QA users (`qa-admin@sprintscaleit.co.uk`, etc.) must exist in the **staging** Supabase project Auth.
> 2. The `sprintscale-qa` company and seed data must be present (run `npm run qa:seed` against staging DB).
> 3. `QA_BYPASS_AUTH` must **not** be set in Vercel — auth tests require real Supabase login.

---

## Deployment steps

```bash
# 1. Ensure TypeScript is clean
npx tsc --noEmit

# 2. Run smoke tests against staging (required)
BASE_URL=https://your-preview-url.vercel.app npm run qa:smoke:staging

# 3. Merge to main / push to production branch
git push origin main

# 4. Vercel auto-deploys — monitor the build log in Vercel dashboard
# Build time: ~60-90 seconds

# 5. Verify deployment completed
open https://your-domain.com/admin/login
```

---

## Post-deployment smoke checks

Run these within 10 minutes of every deployment:

- [ ] 🔴 `/admin/login` loads and login form is visible
- [ ] 🔴 Log in with a real production admin account
- [ ] 🔴 `/admin` (dashboard) loads without errors
- [ ] 🔴 `/admin/clients` shows client list
- [ ] 🔴 `/admin/staff` shows staff list
- [ ] 🔴 `/api/admin/system/health` returns `{ database: true }`
- [ ] 🟡 Create a test client, then delete it
- [ ] 🟡 Check `/admin/audit-log` shows recent activity

---

## Rollback process

Vercel makes rollback instant:

1. Vercel Dashboard → Deployments
2. Find the last known-good deployment
3. Click **"Promote to Production"**
4. Verify health endpoint returns `{ database: true }`

For database rollbacks (rare):
1. Restore from Supabase backup (Pro plan has point-in-time restore)
2. Or: write and apply a compensating migration to revert schema changes
3. Re-deploy the previous app version

---

## Seed restrictions

| Script | Allowed in production? |
|---|---|
| `scripts/seed-qa-environment.ts` | ❌ NEVER |
| `scripts/reset-qa-environment.ts` | ❌ NEVER |
| `scripts/seed-demo-data.ts` | ⚠️ Only if explicitly intended for demo |

All QA scripts filter by `SprintScale QA` company slug, but running them against
the wrong database (production) would pollute real data.

---

## Security checklist (pre-launch)

- [ ] 🔴 Security headers verified (`X-Frame-Options`, `X-Content-Type-Options`, CSP)
  - Visit `https://securityheaders.com/?q=your-domain.com`
- [ ] 🔴 No `QA_BYPASS_AUTH` in Vercel env vars
- [ ] 🔴 `SUPABASE_SERVICE_ROLE_KEY` marked sensitive in Vercel (not exposed in logs)
- [ ] 🟡 Content Security Policy tested (check browser console for CSP violations)
- [ ] 🟡 Rate limiting active on mutation endpoints (incident create, file upload, invite)
- [ ] 🟡 Supabase RLS policies reviewed for each table

---

## Ongoing deployment hygiene

- Deploy at least weekly to keep dependencies fresh
- Apply Supabase migrations in order — never skip or reorder
- Tag releases in Git: `git tag v1.x.x && git push origin --tags`
- Keep `.env.local.example` up to date whenever env vars change
- Run `BASE_URL=https://your-preview-url.vercel.app npm run qa:smoke:staging` before every production release
- Run `npm run qa:smoke` (local) during active development to catch regressions early
