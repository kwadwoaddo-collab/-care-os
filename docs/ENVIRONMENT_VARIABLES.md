# Environment Variables — Care OS

All variables consumed by the application.  
Copy `.env.local.example` → `.env.local` and fill in real values before running locally.

---

## Required in all environments

| Variable | Required | Dev default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | — | Supabase project REST/auth endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | — | Supabase anon (public) API key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | — | Supabase service-role key (server-side only, bypasses RLS) |
| `NEXT_PUBLIC_APP_URL` | ✅ Yes | `http://localhost:3000` | Base URL used in server-side fetches and email links |
| `RESEND_API_KEY` | ✅ Yes (for email) | — | Resend API key for transactional email |
| `EMAIL_FROM` | ✅ Yes (for email) | — | Verified sender address for all outgoing emails |
| `EMAIL_REPLY_TO` | ❌ No | — | Optional reply-to address included in all emails |
| `INVITE_FROM_EMAIL` | ⚠️ Deprecated | — | Legacy sender var — superseded by `EMAIL_FROM`. Still read as fallback. |
| `CRON_SECRET` | ✅ Yes (for cron) | — | Bearer token authenticating Vercel Cron requests to `/api/cron/*`. Fail-closed: no secret = all cron requests denied. |

---

## Optional / dev-only

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `QA_BYPASS_AUTH` | ❌ No | `false` | Set `true` **in `.env.local` only** to skip Supabase session checks. Requires `NODE_ENV=development`. **NEVER set in Vercel or production.** |
| `QA_EMAIL_MODE` | ❌ No | `false` | Set `true` in seed scripts to log email notifications instead of sending them. Only used by `scripts/seed-qa-environment.ts`. |
| `NEXT_PUBLIC_BUILD_TIME` | ❌ No | `unknown` | ISO timestamp injected at build time. Shown in `/admin/system`. Set via `NEXT_PUBLIC_BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) npm run build`. |

---

## Variable details

### `NEXT_PUBLIC_SUPABASE_URL`
```
https://your-project-ref.supabase.co
```
Found in: Supabase Dashboard → Project Settings → API → Project URL.  
Used by: browser client, server client, middleware/proxy, seed scripts.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
```
eyJh...
```
Found in: Supabase Dashboard → Project Settings → API → `anon public`.  
**Safe to expose in the browser** — enforced by Row-Level Security policies.  
Used by: browser Supabase client (auth), server-side session refresh.

### `SUPABASE_SERVICE_ROLE_KEY`
```
eyJh...
```
Found in: Supabase Dashboard → Project Settings → API → `service_role`.  
⚠️ **NEVER expose in the browser or commit to source control.**  
Bypasses RLS — used only in server-side Route Handlers and seed scripts.  
Lives in: `lib/supabase/admin.ts`.

### `NEXT_PUBLIC_APP_URL`
```
http://localhost:3000                    # dev
https://care-os.sprintscaleit.co.uk     # production
```
Used by: server components, API routes, email magic links.

### `RESEND_API_KEY`
```
re_xxxxxxxxxxxx
```
Found in: https://resend.com/api-keys  
Used by: `lib/email/sendEmail.ts` (central email wrapper).  
⚠️ **Never expose in the browser.**

### `EMAIL_FROM`
```
Care OS <notifications@care.sprintscaleit.co.uk>
```
The verified sender address for **all** outgoing emails (invites, notifications, digests).

**Production value:** `Care OS <notifications@care.sprintscaleit.co.uk>`

Requirements:
- The domain (`care.sprintscaleit.co.uk`) must be verified in Resend.
- Until verified, Resend restricts sends to your own account email only.
- See **Resend domain verification** section below.

### `EMAIL_REPLY_TO`
```
support@sprintscaleit.co.uk
```
Optional. When set, all emails include a `Reply-To` header so recipients can reply to a support inbox rather than the noreply sender.

### `INVITE_FROM_EMAIL` (deprecated)
```
Care OS <notifications@care.sprintscaleit.co.uk>
```
Retained as a fallback while migrating. Prefer `EMAIL_FROM`. Will be removed in a future release.

### `CRON_SECRET`
```
a-long-random-string-32-chars-minimum
```
A shared secret that Vercel Cron injects as `Authorization: Bearer <secret>` when calling scheduled endpoints.

**How it works:**
- Set `CRON_SECRET` in Vercel → Project Settings → Environment Variables (all environments, but only used in deployed environments).
- Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to all cron invocations defined in `vercel.json`.
- If `CRON_SECRET` is not set, the endpoint denies **all** requests (fail-closed, not fail-open).

**Scheduled endpoints protected by this secret:**
- `GET /api/cron/compliance-reminders` — runs daily at 07:00 UTC

**Generate a suitable secret:**
```bash
openssl rand -base64 32
```

**Test locally:**
```bash
# Start the dev server in one terminal
npm run dev

# In another terminal — trigger the cron manually
curl -X GET http://localhost:3000/api/cron/compliance-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Test in production:**
```bash
curl -X GET https://care-os-flame.vercel.app/api/cron/compliance-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```
Expected response: `{ "processed": N, "sent": N, "skipped": N, ... }`

**Verify unauthorized requests are rejected:**
```bash
curl -X GET https://care-os-flame.vercel.app/api/cron/compliance-reminders
# Expected: 401 Unauthorized
```

⚠️ **Never** commit this value to source control or include it in `NEXT_PUBLIC_*` variables.

### `QA_BYPASS_AUTH`
```
true   # only in .env.local for local QA testing
```
When `true` **and** `NODE_ENV=development`, `requireAdmin()` returns a synthetic
dev context (`userId='dev-admin'`, `role='company_admin'`) without checking
Supabase Auth.

Production safeguards:
- `proxy.ts` evaluates the flag at module load. If `NODE_ENV` is not `development`,
  the flag is structurally ignored.
- `requireAdmin.ts` will `throw` if the bypass code path is somehow reached with
  `NODE_ENV=production`.
- Vercel automatically sets `NODE_ENV=production` for all deployments.

**Never** add this variable to Vercel Environment Variables.

### `QA_EMAIL_MODE`
```
true
```
Seed-script only. Prevents real emails from being sent during QA seeding.

### `NEXT_PUBLIC_BUILD_TIME`
```
2026-05-01T14:00:00Z
```
Optional. Shown in the `/admin/system` health page for deployment tracking.

---

## Resend domain verification (required for production)

Resend restricts unverified accounts to sending only to your own email address. To lift this restriction you must verify your sending domain.

### Steps

1. Log in to [resend.com](https://resend.com) and go to **Domains → Add Domain**.
2. Enter `care.sprintscaleit.co.uk` (or your chosen subdomain).
3. Resend will display DNS records to add. Add all of them to your DNS provider:

| Type | Name | Value |
|------|------|-------|
| MX | `care.sprintscaleit.co.uk` | `feedback-smtp.us-east-1.amazonses.com` (priority 10) |
| TXT | `care.sprintscaleit.co.uk` | SPF record provided by Resend |
| CNAME | `resend._domainkey.care.sprintscaleit.co.uk` | DKIM record provided by Resend |

> **Note:** Exact record values are shown in the Resend dashboard after you add the domain. Copy them directly — do not guess.

4. Click **Verify** in Resend. DNS propagation typically takes 5–30 minutes.
5. Once verified, update your Vercel environment variables:
   ```
   EMAIL_FROM=Care OS <notifications@care.sprintscaleit.co.uk>
   ```
6. Redeploy (or trigger a new Vercel build) for the change to take effect.

### Verify the configuration locally

```bash
npm run email:test -- your@email.com
```

This sends a test email using your `.env.local` config and prints the Resend message ID on success.

---

## Production `.env.local` / Vercel env example

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
NEXT_PUBLIC_APP_URL=https://care-os.sprintscaleit.co.uk
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Care OS <notifications@care.sprintscaleit.co.uk>
EMAIL_REPLY_TO=support@sprintscaleit.co.uk
CRON_SECRET=your-generated-secret-here
```

---

## Security checklist

| Check | Status |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` never in browser bundle | ✅ server-only (`import 'server-only'`) |
| `RESEND_API_KEY` never in browser bundle | ✅ server-only (`lib/email/sendEmail.ts`) |
| `CRON_SECRET` never in browser bundle | ✅ server-only (`app/api/cron/*/route.ts`) |
| `QA_BYPASS_AUTH` never in Vercel env vars | ✅ throw guard if reached in production |
| `.env.local` gitignored | ✅ |
| No secrets in `NEXT_PUBLIC_*` vars | ✅ anon key only |
| No hard-coded credentials in source | ✅ audited |

---

## Setting up for local dev

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Fill in RESEND_API_KEY + EMAIL_FROM (or leave blank to skip email)
# Optionally: QA_BYPASS_AUTH=true for local QA without a login session
npm run dev

# Test email sending:
npm run email:test -- your@email.com
```
