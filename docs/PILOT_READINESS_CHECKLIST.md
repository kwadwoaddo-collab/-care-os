# Care OS — Pilot Readiness Checklist

**Purpose:** Run through this list before onboarding any real staff member.  
**Pilot scope:** Onboarding + compliance only. BrightHR remains the sign-in system.  
**Items marked 🔴 are hard blockers. Items marked 🟡 are strongly recommended.**

---

## 1. Environment Variables

Verify in **Vercel → Project → Settings → Environment Variables** (Production environment).

| Variable | Required | Check |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 🔴 | [ ] Set to production Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🔴 | [ ] Set to production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 | [ ] Set and marked **sensitive** |
| `NEXT_PUBLIC_APP_URL` | 🔴 | [ ] Exact production URL — no trailing slash |
| `RESEND_API_KEY` | 🔴 | [ ] Production Resend key |
| `INVITE_FROM_EMAIL` | 🔴 | [ ] Verified sending address |

**Variables that must NOT exist in production:**

- [ ] 🔴 `QA_BYPASS_AUTH` — must be absent (its presence disables auth)
- [ ] 🔴 `QA_EMAIL_MODE` — scripts-only; must not be set in Vercel

> **Tip:** After verifying, trigger a fresh Vercel deployment to ensure all env vars are picked up.

---

## 2. Email Domain (Resend)

Outbound emails (invites, onboarding links, reminders) depend on a verified sending domain.

- [ ] 🔴 Domain used in `INVITE_FROM_EMAIL` is verified in the Resend dashboard
- [ ] 🔴 SPF record added to DNS (`v=spf1 include:_spf.resend.com ~all`)
- [ ] 🔴 DKIM record added to DNS (from Resend → Domains → your domain)
- [ ] 🟡 DMARC record added: `v=DMARC1; p=none; rua=mailto:admin@yourdomain.com`
- [ ] 🟡 Send a test email: `npm run email:test` — confirm receipt, check spam score

> **Current config:** `INVITE_FROM_EMAIL=Care Supreme <onboarding@resend.dev>`  
> For pilot: keep `resend.dev` only if you cannot verify your own domain.  
> For production: replace with `noreply@yourcompany.co.uk` once domain is verified.

---

## 3. Supabase Migrations

Confirm all schema migrations are applied to the **production** Supabase project.

- [ ] 🔴 Open Supabase SQL Editor on the **production** project (not local/QA)
- [ ] 🔴 Confirm all migration files from `supabase/migrations/` are applied in order

Run to verify key tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables: `applicants`, `audit_logs`, `companies`, `compliance_items`,
`documents`, `form_answers`, `form_fields`, `form_responses`, `incidents`,
`interviews`, `notification_logs`, `profiles`, `shifts`, `staff_profiles`,
`timesheets`, `visit_notes`.

- [ ] 🔴 `staff_profiles` table includes `portal_token_hash`, `portal_token_expires_at`, `onboarding_stage`
- [ ] 🔴 `documents` table includes `review_status`, `reviewed_by`, `reviewed_at`, `review_notes`
- [ ] 🟡 Row-Level Security enabled on all tables (Supabase → Table Editor → RLS column)

---

## 4. QA Seed Separation

Ensure test/demo data cannot be confused with real pilot data.

- [ ] 🔴 QA seed scripts have **NOT** been run against the production database
- [ ] 🔴 No companies with `slug = 'sprintscale-qa'` exist in production
- [ ] 🔴 No staff or applicant records prefixed with `[QA]` exist in production
- [ ] 🟡 Run the audit query to confirm:

```sql
SELECT id, name, slug FROM companies WHERE slug LIKE '%qa%' OR name ILIKE '%qa%' OR name ILIKE '%test%';
```

```sql
SELECT id, first_name, last_name FROM staff_profiles WHERE first_name ILIKE '[QA]%' LIMIT 10;
```

> **Rule:** QA seed scripts (`scripts/seed-qa-environment.ts`) must only ever be run  
> against a local or staging Supabase project. Never against the production URL.

---

## 5. Admin Accounts

At least one admin account must exist before inviting pilot staff.

- [ ] 🔴 Admin user created in Supabase Auth (production project) — see `docs/admin-auth-setup.md`
- [ ] 🔴 Matching `profiles` row exists with `role = 'company_admin'`
- [ ] 🔴 Admin can log in at `/admin/login` and reach the dashboard
- [ ] 🔴 Company row exists in `companies` table with correct `name` and `slug`
- [ ] 🟡 A second admin account exists for backup access

Verify with:
```sql
SELECT p.id, p.email, p.role, c.name AS company
FROM profiles p
JOIN companies c ON c.id = p.company_id
WHERE p.role IN ('company_admin', 'admin', 'super_admin');
```

---

## 6. Resend Sending (End-to-End Test)

Before inviting real staff, confirm the full invite email flow works.

- [ ] 🔴 Go to `/admin/applicants` → invite a **test** applicant using a personal email you control
- [ ] 🔴 Confirm the invite email is received (check inbox + spam folder)
- [ ] 🔴 Click the magic link in the email — confirm it opens the onboarding portal
- [ ] 🟡 Check `notification_logs` table in Supabase — entry should show `status = 'sent'`

---

## 7. Document Storage

Staff will upload documents (DBS, ID, right to work). Confirm storage is ready.

- [ ] 🔴 Supabase Storage bucket named `care-os-documents` exists
- [ ] 🔴 Bucket is set to **Private** (not public — files are accessed via signed URLs)
- [ ] 🔴 Upload a test PDF via the worker portal — confirm it appears in admin document review
- [ ] 🔴 Admin can download/view the uploaded document
- [ ] 🟡 Storage policies allow service-role writes and anon reads via signed URLs only

---

## 8. Onboarding Links (Worker Portal Access)

Staff access their onboarding portal via a magic link. Confirm the full flow.

- [ ] 🔴 Invite a test applicant → they receive an email with a portal link
- [ ] 🔴 Opening the link redirects to `/portal/[token]` and shows the onboarding form
- [ ] 🔴 Portal token expires as expected (check `portal_token_expires_at` in `staff_profiles`)
- [ ] 🔴 Expired tokens show an appropriate error message (not a blank page or crash)
- [ ] 🟡 Mobile browsers tested: iOS Safari + Android Chrome open the portal correctly

---

## 9. Worker Mobile Access

Many care workers will access the portal from a smartphone.

- [ ] 🔴 Open the portal link on an **iPhone** (iOS Safari) — confirm it loads
- [ ] 🔴 Open the portal link on an **Android** phone (Chrome) — confirm it loads
- [ ] 🔴 Document upload via camera works on mobile (file picker accepts photos)
- [ ] 🟡 Forms are readable without horizontal scrolling on a 375px wide screen
- [ ] 🟡 Buttons are large enough to tap without mis-tapping on mobile

---

## Summary Sign-Off

Complete all 🔴 items before onboarding any real staff member.

| Section | Status |
|---|---|
| 1. Environment variables | [ ] Ready |
| 2. Email domain (Resend) | [ ] Ready |
| 3. Supabase migrations | [ ] Ready |
| 4. QA seed separation | [ ] Ready |
| 5. Admin accounts | [ ] Ready |
| 6. Resend sending (e2e test) | [ ] Ready |
| 7. Document storage | [ ] Ready |
| 8. Onboarding links | [ ] Ready |
| 9. Worker mobile access | [ ] Ready |

**Sign-off:** _________________________ **Date:** _____________

> **Pilot scope reminder:** Care OS is used for onboarding and compliance only.  
> BrightHR remains the sign-in system for shifts, attendance, and payroll.  
> Do not retire BrightHR until Phase 2 is explicitly scoped and approved.
