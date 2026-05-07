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
| `INVITE_FROM_EMAIL` | ✅ Yes (for email) | — | Verified sender address for applicant invites |

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
http://localhost:3000       # dev
https://care-os.example.com # production
```
Used by: 43 places across server components and API routes for constructing
internal fetch URLs and magic-link callbacks.

### `RESEND_API_KEY`
```
re_xxxxxxxxxxxx
```
Found in: https://resend.com/api-keys  
Used by: `lib/email/resend.ts`, `lib/notifications/sendNotification.ts`.

### `INVITE_FROM_EMAIL`
```
noreply@yourdomain.com
```
Must be a domain verified in your Resend account.  
Used by: applicant invite emails.

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

## Security checklist

| Check | Status |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` never in browser bundle | ✅ server-only (`import 'server-only'`) |
| `QA_BYPASS_AUTH` never in Vercel env vars | ✅ throw guard if reached in production |
| `.env.local` gitignored | ✅ |
| No secrets in `NEXT_PUBLIC_*` vars | ✅ anon key only |
| No hard-coded credentials in source | ✅ audited |

---

## Unused / deprecated vars

None found. All 10 env vars are actively consumed.

---

## Setting up for local dev

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Fill in RESEND_API_KEY + INVITE_FROM_EMAIL (or leave blank to skip email)
# Optionally: QA_BYPASS_AUTH=true for local QA without a login session
npm run dev
```
