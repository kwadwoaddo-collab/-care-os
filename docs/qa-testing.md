# QA Testing Guide — Care OS

> **Audience:** Developers, QA engineers, and product managers running pre-release verification.

---

## Overview

The Care OS QA environment is a fully isolated, realistic test dataset scoped to the **SprintScale QA** company. All QA records are prefixed with `[QA]` and are never mixed with production data.

---

## Safety Rules

> [!CAUTION]
> **Never run QA scripts against a production Supabase project without first reading the safety rules below.**

| Rule | Detail |
|------|--------|
| ✅ Company isolation | All QA data belongs to the `SprintScale QA` company only |
| ✅ `[QA]` tagging | Every seeded record has `[QA]` in its name / description |
| ✅ No auth bypasses | Auth users are created via Supabase Admin API with proper RLS |
| ✅ No destructive ops | Reset script only deletes rows where `company_id` = SprintScale QA |
| ❌ Never seed on prod | Use a staging / development Supabase project |
| ❌ Never share creds | QA passwords (`ChangeMe123!`) are for test only — not real accounts |

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Company Admin | `qa-admin@sprintscaleit.co.uk` | `ChangeMe123!` |
| Coordinator | `qa-coordinator@sprintscaleit.co.uk` | `ChangeMe123!` |
| Care Worker | `qa-worker@sprintscaleit.co.uk` | `ChangeMe123!` |

> [!NOTE]
> These accounts exist in your Supabase Auth table after running the seeder. They are scoped to the `SprintScale QA` company and subject to normal RLS policies.

---

## How to Seed

### Prerequisites

1. Copy `.env.local.example` → `.env.local` and fill in your Supabase credentials.
2. Ensure `tsx` is available (`npx tsx --version`).
3. Point your `.env.local` at a **non-production** Supabase project.

### Seed the full QA environment

```bash
npx tsx scripts/seed-qa-environment.ts
```

### Preview without writing to the database (dry run)

```bash
npx tsx scripts/seed-qa-environment.ts --dry-run
```

### Seed with fake email mode (log notifications, don't send)

```bash
QA_EMAIL_MODE=true npx tsx scripts/seed-qa-environment.ts
```

### What gets seeded

| Entity | Count | Mixed States |
|--------|-------|-------------|
| Auth users | 3 | admin / coordinator / care_worker |
| Clients | 10 | active, paused, prospective, ended |
| Staff profiles | 10 | active, pre_employment, suspended |
| Care packages | 5 | active, paused, draft |
| Shifts | 40 | scheduled, confirmed, completed, cancelled, no_show |
| Visit notes | 15 | submitted, draft |
| Incidents | 5 | open, investigating, resolved, closed |
| Timesheets | 8 | pending, clocked_in, completed, missed, adjusted |
| Documents | 20 | DBS, RTW, contracts, training certs |
| Compliance items | ~60 | expired, expiring, valid, not_started |

Compliance scenarios baked in:
- 🔴 **Expired** — staff 1 & 5 have expired DBS / compliance
- 🟡 **Expiring soon** — staff 2 & 8 have items expiring in < 30 days
- 🔵 **Onboarding incomplete** — staff 6 not yet onboarded
- ⚪ **Mostly complete** — remaining staff are in good standing

---

## How to Reset

The reset script permanently deletes **all** SprintScale QA data from the database and removes the three QA auth users. It will never touch other companies.

### Interactive reset (asks for confirmation)

```bash
npx tsx scripts/reset-qa-environment.ts
```

You will be prompted:

```
⚠️  This will delete ALL data in "SprintScale QA".
   Type YES to confirm:
```

### Force reset without confirmation (CI / automation)

```bash
npx tsx scripts/reset-qa-environment.ts --force
```

### Dry-run reset (preview only)

```bash
npx tsx scripts/reset-qa-environment.ts --dry-run
```

### Full cycle (reset then re-seed)

```bash
npx tsx scripts/reset-qa-environment.ts --force && npx tsx scripts/seed-qa-environment.ts
```

---

## QA Dashboard Banner

When logged in as a user whose company name contains **"QA"**, a persistent amber banner will appear at the top of every admin page:

```
⚠️  QA Environment — Test Data Only. Do not use real client or staff information.  ⚠️
```

This banner:
- Is rendered server-side in the admin layout
- Only shows for the QA company — production users never see it
- Has the HTML `id="qa-environment-banner"` for automated testing

---

## Fake Email Mode (`QA_EMAIL_MODE`)

By default, Care OS sends real emails via Resend. During QA stress testing you may want to suppress real sends while still verifying that notification logs are written.

Set `QA_EMAIL_MODE=true` in your shell or `.env.local`:

```bash
QA_EMAIL_MODE=true npx tsx scripts/seed-qa-environment.ts
```

Effect:
- Notification log rows are written with `status = 'skipped'`
- `error_message = 'QA_EMAIL_MODE=true — email not sent'`
- No real emails are delivered

> [!TIP]
> You can query `notification_logs` in Supabase to verify the logs are being written correctly.

---

## Playwright Smoke Tests

### Install Playwright (first time only)

```bash
npx playwright install --with-deps chromium
```

### Run all smoke tests

```bash
npx playwright test tests/smoke/
```

### Run against a specific URL (staging)

```bash
PLAYWRIGHT_BASE_URL=https://staging.care-os.example.com npx playwright test tests/smoke/
```

### Run a single file

```bash
npx playwright test tests/smoke/auth.smoke.ts
```

### Run in headed mode (watch browser)

```bash
npx playwright test tests/smoke/ --headed
```

### View HTML report

```bash
npx playwright show-report
```

### Test Coverage

| File | Tests |
|------|-------|
| `auth.smoke.ts` | Login for all 3 QA roles, invalid credentials |
| `clients.smoke.ts` | Client list loads, QA data visible, create client |
| `shifts.smoke.ts` | Shift list loads, QA data visible, create shift, assign worker |
| `incidents.smoke.ts` | Incident list loads, QA data visible, create incident |
| `documents.smoke.ts` | Document upload UI, visit note list, submit note |

---

## npm Scripts (add to package.json)

You can add these convenience scripts to `package.json`:

```json
{
  "scripts": {
    "qa:seed":   "tsx scripts/seed-qa-environment.ts",
    "qa:reset":  "tsx scripts/reset-qa-environment.ts",
    "qa:dry":    "tsx scripts/seed-qa-environment.ts --dry-run",
    "qa:smoke":  "playwright test tests/smoke/",
    "qa:cycle":  "tsx scripts/reset-qa-environment.ts --force && tsx scripts/seed-qa-environment.ts"
  }
}
```

---

## TypeScript Validation

Always run the TypeScript checker before committing QA scripts:

```bash
npx tsc --noEmit
```

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `Missing SUPABASE_SERVICE_ROLE_KEY` | `.env.local` not populated | Copy `.env.local.example` and fill in values |
| `Auth user already exists` | Re-running seeder | Safe to ignore — script reuses existing users |
| Smoke tests can't find buttons | UI element selectors changed | Update `tests/smoke/*.ts` selectors to match current UI |
| `SprintScale QA company not found` on reset | Company was never seeded | Run seed first |
| Compliance items not showing | Seeder ran but RLS blocked | Check Supabase policies; seeder uses service role key |

---

## Files Reference

```
scripts/
  qa-helpers.ts              ← Reusable builder functions (createQaClient, etc.)
  seed-qa-environment.ts     ← Full seeder (Tasks 1-6)
  reset-qa-environment.ts    ← Safe teardown script (Task 4)

tests/smoke/
  auth.smoke.ts              ← Login flow tests
  clients.smoke.ts           ← Client creation / listing
  shifts.smoke.ts            ← Shift creation / worker assignment
  incidents.smoke.ts         ← Incident reporting
  documents.smoke.ts         ← Document upload + visit notes

playwright.config.ts         ← Playwright test runner configuration

app/admin/layout.tsx         ← QA banner rendered when company = "QA"

docs/qa-testing.md           ← This file
```
