# Care OS — Pilot Rollout Checklist

**Pilot scope:** 1 site · 2–3 coordinators · 5–20 workers  
**Timeline:** 4-week pilot window  
**Version:** Care OS v1 (Phases 1 onboarding + compliance)

---

## Part 1 — Pre-Launch Tasks

Complete ALL items before inviting any real users.

### 1.1 Environment & Infrastructure

- [ ] **Production URL set**  
  `NEXT_PUBLIC_APP_URL` in Vercel → Settings → Environment Variables  
  Must be your Vercel deployment URL (e.g. `https://care-os.vercel.app`), not localhost

- [ ] **QA_BYPASS_AUTH absent**  
  Confirm `QA_BYPASS_AUTH` is not set in Vercel production environment  
  (If present: remove it immediately — it disables all authentication)

- [ ] **CRON_SECRET configured**  
  Add a random secret to Vercel env vars: `CRON_SECRET=<strong-random-string>`  
  This protects all 5 cron job endpoints from unauthorized calls

- [ ] **Vercel Cron schedules active**  
  Check Vercel → Project → Cron Jobs. All 5 jobs should be listed:
  - `compliance-sweep` (daily)
  - `compliance-reminders` (daily)
  - `lifecycle-automation` (daily)
  - `anomaly-scan` (daily)
  - `escalation-scan` (daily)  
  If not auto-detected: add `vercel.json` cron configuration

- [ ] **RESEND_API_KEY configured**  
  Set your Resend API key in Vercel environment variables

- [ ] **INVITE_FROM_EMAIL configured**  
  Must use a verified custom domain (e.g. `noreply@youragency.co.uk`)  
  Not resend.dev — real emails may be rejected or land in spam

- [ ] **SPF / DKIM verified**  
  Log in to Resend → Domains. Status must show "Verified" for your sending domain.  
  If not: follow Resend's DNS configuration guide and wait up to 24h for propagation

- [ ] **Storage bucket is PRIVATE**  
  Supabase → Storage → care-os-documents → Settings  
  Bucket must NOT be public. All access must be via signed URLs only.

- [ ] **Supabase URL points to production project**  
  `NEXT_PUBLIC_SUPABASE_URL` must be the production project URL, not a local instance

- [ ] **Run pilot verify script**  
  ```bash
  npm run pilot:verify:production
  ```
  Must exit with 0 blockers before proceeding

### 1.2 Data Cleanup

- [ ] **Take a database backup**  
  Supabase → Settings → Database → Backups → Download  
  Keep this backup before running cleanup

- [ ] **Dry-run the cleanup script**  
  ```bash
  npx tsx scripts/cleanup-demo-data.ts --dry-run --verbose
  ```
  Review the output — confirm only demo/QA records are shown

- [ ] **Execute the cleanup**  
  ```bash
  npx tsx scripts/cleanup-demo-data.ts --confirm
  ```
  Note: this permanently deletes all demo/QA operational data

- [ ] **Verify cleanup result**  
  Run `npm run pilot:verify` — confirm no QA data pollution reported

### 1.3 Company Configuration

- [ ] **Pilot company record exists**  
  At least one non-QA company record in the `companies` table

- [ ] **Tenant config set**  
  In Supabase → Table Editor → `tenant_config` for your company:
  - `is_pilot = true`
  - `go_live_date = YYYY-MM-DD` (today)
  - `setup_completed_at = NOW()`
  - `require_dbs = true`
  - `require_rtw = true`
  - `block_non_compliant_staff = true`
  - `block_expired_dbs = true`
  - `block_expired_rtw = true`

- [ ] **Tenant branding set** (optional but recommended)  
  In `tenant_branding`: add company name, logo URL, accent colour

### 1.4 Admin Accounts

- [ ] **Company admin account exists**  
  At least one profile with `role = company_admin` for the pilot company  
  This person can access all admin areas

- [ ] **Coordinator accounts created**  
  Create profiles with `role = coordinator` for 2–3 coordinators  
  They will manage day-to-day onboarding and compliance review

- [ ] **Admin password set**  
  All admin accounts must have completed the `/admin/set-password` flow  
  Test: log out and log back in with each admin account

### 1.5 End-to-End Pre-Flight Test

Do this with a personal test email before inviting any real users.

- [ ] **Send a test invite**  
  Admin → Applicants → + Invite applicant → use your personal email  
  Confirm the invite email arrives (check spam too)

- [ ] **Complete test onboarding**  
  Click the magic link → fill all form sections → upload a blank PDF  
  Confirm all sections show as complete in the admin view

- [ ] **Approve a test document**  
  Admin → Onboarding → test applicant → Documents → Approve  
  Confirm status changes to Approved and compliance score updates

- [ ] **Check compliance state**  
  After approval: confirm the staff profile shows `compliant` or `warning` state  
  Non-compliant workers must not reach `deployable` state

- [ ] **Test on mobile**  
  Open the portal link on an iPhone (Safari) and Android (Chrome)  
  Confirm forms are readable and document upload works from camera roll

- [ ] **Delete test applicant** after pre-flight  
  Admin → Applicants → test record → Archive or delete

---

## Part 2 — Coordinator Onboarding Process

Do this before coordinators use the system with real workers.

### 2.1 Coordinator Briefing

- [ ] Walk coordinator through the admin dashboard (`/admin`)
- [ ] Show the Operations page (`/admin/operations`) — explain Top Priorities
- [ ] Show the Compliance dashboard (`/admin/compliance`)
- [ ] Show the Onboarding pipeline (`/admin/onboarding/pipeline`)
- [ ] Show how to invite an applicant (`/admin/applicants`)
- [ ] Show how to review and approve documents
- [ ] Show how to activate a worker (status: active)
- [ ] Explain the difference between Care OS (onboarding/compliance) and BrightHR (scheduling/attendance)

### 2.2 Coordinator Access Verification

- [ ] Each coordinator can log in at `/admin/login`
- [ ] Each coordinator can see the Onboarding pipeline
- [ ] Each coordinator can invite applicants
- [ ] Each coordinator can approve/reject documents
- [ ] Each coordinator cannot access billing or super-admin areas (if applicable)

---

## Part 3 — Worker Onboarding Process

Follow this sequence for each new worker during the pilot.

### 3.1 Pre-Invite

- [ ] Confirm worker is a new hire (not already in BrightHR as onboarded)
- [ ] Collect worker's name, email, and intended job role

### 3.2 Invite

- [ ] Admin → Applicants → + Invite applicant
- [ ] Enter name, email, job role
- [ ] Send invite
- [ ] Confirm invite email is delivered (check with the worker)

### 3.3 Applicant Portal

The worker will:
- [ ] Receive magic link email
- [ ] Click link → complete application form
- [ ] Provide: name, date of birth, address, emergency contact, NI number, bank details, employment type
- [ ] Upload required documents (DBS, passport/RTW, proof of address)
- [ ] Acknowledge the company policy
- [ ] Submit onboarding

### 3.4 Admin Review

- [ ] Coordinator reviews submitted documents in `/admin/documents/verification`
- [ ] For each document: verify against original (if required) → Approve or Reject
- [ ] If rejected: worker receives notification and can resubmit
- [ ] Once all mandatory docs approved: compliance engine calculates state

### 3.5 Activation

- [ ] Compliance check passes (`compliant` or `warning` state)
- [ ] Coordinator reviews activation checklist in `/admin/staff/[id]`
- [ ] Coordinator clicks **Activate** → status changes to `active`
- [ ] Worker now appears in Staff list and can be assigned to shifts

### 3.6 Post-Activation

- [ ] Worker receives portal invite (separate from applicant magic link)
- [ ] Worker logs in to worker portal `/worker`
- [ ] Worker can view assigned shifts, submit visit notes, track compliance

---

## Part 4 — Rollback Plan

If a critical issue is discovered after go-live, follow this sequence.

### 4.1 Immediate Rollback (< 1 hour)

1. Set `QA_BYPASS_AUTH=true` in Vercel (this disables auth — do only if system is completely broken)
2. Or: revert to the previous Vercel deployment via Vercel → Deployments → Promote previous

### 4.2 Data Rollback

If data has been corrupted or accidentally deleted:
1. Stop new writes (take site offline if needed — Vercel → Project → Pause)
2. Restore from the pre-pilot backup taken in Step 1.2
3. Contact Supabase support if point-in-time recovery is needed

### 4.3 Partial Rollback

If only one feature is broken:
- Disable the feature via `lib/features.ts` feature flags if applicable
- Route users around the broken page in admin sidebar
- Fix and redeploy — Vercel deploys are typically < 2 minutes

### 4.4 Communication Plan

If a rollback is needed:
- Notify coordinators by phone/WhatsApp immediately
- Do not use Care OS to send the notification (system may be affected)
- Revert to paper/manual process for affected period
- Post-incident review within 24 hours

---

## Part 5 — Daily Operational Review Checklist

Complete each morning before coordinators begin their shift.

### 5.1 Operations Dashboard (`/admin/operations`)

- [ ] Review **Top Priorities** — resolve any Critical items before the shift starts
- [ ] Check for any **uncovered shifts** in the next 24 hours
- [ ] Review **safeguarding alerts** — escalate any that are open >24h
- [ ] Review **compliance blocks** — contact affected workers

### 5.2 Onboarding Pipeline (`/admin/onboarding/pipeline`)

- [ ] Check for **stalled applicants** (no progress >7 days) — send reminder or call
- [ ] Check **document verification queue** — approve/reject pending documents
- [ ] Check for **rejected documents** — confirm worker has been contacted for resubmission

### 5.3 Compliance (`/admin/compliance`)

- [ ] Note any workers moving to `non_compliant` or `blocked` state
- [ ] Check for documents expiring within 14 days — confirm renewal is in progress
- [ ] Confirm no `blocked` workers are currently assigned to upcoming shifts

### 5.4 Notifications

- [ ] Check in-app notification inbox for any system alerts
- [ ] Confirm no failed email notifications in `notification_logs` table

---

## Part 6 — Weekly Governance Checklist

Complete every Friday (or before your weekly operational meeting).

### 6.1 Compliance Health

- [ ] Review **Analytics dashboard** (`/admin/analytics`) — note compliance rate %
- [ ] Pull list of workers in `warning` state — schedule document renewals
- [ ] Confirm all DBS certificates are tracked with correct expiry dates
- [ ] Confirm all RTW documents are tracked and not expired
- [ ] Review **compliance overrides** — confirm each has a valid reason and has not expired

### 6.2 Onboarding Throughput

- [ ] Count applicants invited this week vs. activated this week
- [ ] Note average time from invite → active status
- [ ] Identify any applications that have stalled >14 days — decide to chase or archive

### 6.3 Incident Review

- [ ] Review all **incidents created this week** (`/admin/incidents`)
- [ ] Confirm all escalated incidents have been acknowledged
- [ ] Confirm all safeguarding incidents have been reported to the appropriate authority
- [ ] Review **incident risk scores** — any worker with repeated high-severity incidents?

### 6.4 Operations Queue

- [ ] Clear all **critical** and **urgent** queue items
- [ ] Review overdue items (>48h open) — assign or escalate
- [ ] Dismiss items no longer relevant (with reason recorded)

### 6.5 Document Audit

- [ ] Check `document_audit_log` for any unexpected activity (optional for small pilots)
- [ ] Confirm all approved documents have an approver recorded
- [ ] Review any documents marked `needs_original_seen` — confirm follow-up is scheduled

### 6.6 System Health

- [ ] Check `job_executions` table — confirm all 5 cron jobs ran successfully this week
- [ ] Review `notification_logs` — confirm < 2% failure rate on emails
- [ ] Check `orchestration_audit_log` — confirm priorities are being generated daily

### 6.7 BrightHR Sync Check

- [ ] Confirm all workers activated in Care OS this week are also added to BrightHR
- [ ] Confirm no scheduling conflicts — shifts in Care OS should match BrightHR where used
- [ ] Note any workers who have left — update status in both systems

---

## Pilot Exit Criteria

The pilot is considered successful when:

- [ ] 5+ workers have been fully onboarded (invite → activate) via Care OS
- [ ] 0 critical compliance breaches due to system failure
- [ ] All mandatory documents (DBS, RTW) tracked for every active worker
- [ ] Coordinator can independently manage onboarding without engineering support
- [ ] Compliance rate ≥ 80% (from Analytics dashboard)
- [ ] No data loss incidents
- [ ] Average invite → activate time < 7 days

**On successful exit:** proceed to Phase 2 (shift management, visit notes for all workers)  
**On partial success:** extend pilot by 2 weeks and address specific gaps before scaling
