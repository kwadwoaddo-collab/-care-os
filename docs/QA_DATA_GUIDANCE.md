# Care OS — QA & Demo Data Guidance

**Purpose:** Help admins and developers identify, isolate, and avoid confusing test data with real staff records during the pilot.

---

## How to Identify QA Data

All QA (test) data is isolated to a dedicated company and uses consistent naming conventions.

### QA Company

| Field | Value |
|---|---|
| Company name | `SprintScale QA` |
| Company slug | `sprintscale-qa` |

**SQL to confirm:**
```sql
SELECT id, name, slug FROM companies WHERE slug = 'sprintscale-qa';
```

### QA Users (Auth)

| Email | Role |
|---|---|
| `qa-admin@sprintscaleit.co.uk` | Company admin |
| `qa-coordinator@sprintscaleit.co.uk` | Coordinator |
| `qa-worker@sprintscaleit.co.uk` | Care worker |

### QA Data Prefix

All QA-seeded records are prefixed with `[QA]` in name fields. Examples:

- Staff: `[QA] Alice Adams`
- Clients: `[QA] Client 01`
- Shifts: `[QA] Morning Visit`
- Documents: `[QA] DBS Certificate`

**SQL to find all QA staff:**
```sql
SELECT id, first_name, last_name, email
FROM staff_profiles
WHERE first_name ILIKE '[QA]%'
   OR email ILIKE '%sprintscaleit%';
```

**SQL to find all QA clients:**
```sql
SELECT id, full_name FROM clients WHERE full_name ILIKE '[QA]%';
```

---

## QA vs Real Data: At a Glance

| Signal | QA/Test data | Real pilot data |
|---|---|---|
| Company name | `SprintScale QA` | Your company name |
| Staff names | Start with `[QA]` | Real names |
| Emails | `@sprintscaleit.co.uk` | Real staff emails |
| Staff count | Exactly 10 | Your actual headcount |
| Shifts | `[QA]` in title | Blank or real titles |

---

## Rules: What You Must Never Do

### 1. Never run QA seed scripts against production

```bash
# ❌ FORBIDDEN against production Supabase URL
npm run qa:seed

# ✅ Only safe against local or staging database
NEXT_PUBLIC_SUPABASE_URL=https://staging-xxx.supabase.co npm run qa:seed
```

### 2. Never run reset scripts against production

```bash
# ❌ FORBIDDEN
npm run qa:reset

# This will delete the QA company and all linked data.
# If pointed at production, it will delete your real company's data.
```

### 3. Never set `QA_BYPASS_AUTH=true` in Vercel production

This variable disables authentication entirely. It exists in `.env.local` for local dev only. Verify it is absent from Vercel's production env vars.

---

## How to Check for Data Pollution

Run these queries in the **production** Supabase SQL Editor before or after the pilot begins.

### Check for QA company in production
```sql
SELECT id, name, slug
FROM companies
WHERE slug ILIKE '%qa%' OR name ILIKE '%sprintscale qa%';
-- Expected result: 0 rows
```

### Check for [QA] prefixed staff
```sql
SELECT COUNT(*) AS qa_staff_count
FROM staff_profiles
WHERE first_name ILIKE '[QA]%';
-- Expected result: 0
```

### Check for [QA] prefixed clients
```sql
SELECT COUNT(*) AS qa_client_count
FROM clients
WHERE full_name ILIKE '[QA]%';
-- Expected result: 0
```

### Check for QA email addresses in real profiles
```sql
SELECT id, email FROM profiles WHERE email ILIKE '%sprintscaleit%';
-- Expected result: 0 rows in production
```

---

## How to Clean Up QA Data (If Found in Production)

> ⚠️ **Caution:** Only do this if you are certain these are test records. Do not delete real staff data.

### Step 1: Identify the QA company ID

```sql
SELECT id FROM companies WHERE slug = 'sprintscale-qa';
-- Save this ID for the next steps
```

### Step 2: Delete in dependency order

```sql
-- Replace 'QA_COMPANY_ID' with the actual UUID from step 1

DELETE FROM timesheets WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM visit_notes WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM incidents WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM shifts WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM documents WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM compliance_items WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM care_packages WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM clients WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM staff_profiles WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM profiles WHERE company_id = 'QA_COMPANY_ID';
DELETE FROM companies WHERE id = 'QA_COMPANY_ID';
```

### Step 3: Remove QA auth users (Supabase Admin API)

QA auth users must be removed via the Supabase Dashboard → Authentication → Users.  
Look for users with `@sprintscaleit.co.uk` emails and delete them.

### Step 4: Verify cleanup

Re-run the audit queries above and confirm all return 0 rows.

---

## Staging Environment

The recommended setup for testing before production:

| Environment | Supabase Project | Purpose |
|---|---|---|
| Local dev | `localhost` / local DB | Active development |
| Staging | Separate Supabase project | Smoke tests, QA seed allowed |
| Production | Production Supabase | Real pilot data only |

Always use `BASE_URL=https://your-staging-url.vercel.app npm run qa:smoke:staging` to run automated tests against staging, never production.

---

*Last updated: May 2026 — Care OS Pilot v1*
