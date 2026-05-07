# Care OS — Go-Live Readiness Checklist

**Target: Controlled internal live use**
**Complete every section before allowing real data entry.**

---

## 1. Code Checkpoint

- [ ] Run `git status` — confirm no uncommitted changes to auth, middleware, or API routes
- [ ] Commit latest auth work with a clear message (e.g. `feat: admin auth + company isolation hardening`)
- [ ] Push branch to remote: `git push origin feat/auth-and-multi-tenant-hardening`
- [ ] Open a pull request and merge to `main`
- [ ] Confirm Vercel deployment triggered automatically
- [ ] Wait for Vercel build to complete — check build logs for errors
- [ ] Visit the production URL and confirm the app loads

---

## 2. Environment Variables

Check in Vercel dashboard → Project → Settings → Environment Variables.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | From Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Secret — never expose to browser |
| `NEXT_PUBLIC_APP_URL` | Yes | Full URL e.g. `https://care-os.vercel.app` |
| `RESEND_API_KEY` | Yes | From Resend dashboard |
| `INVITE_FROM_EMAIL` | Yes | Verified sending address e.g. `noreply@yourdomain.com` |

- [ ] All variables present in Vercel production environment
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT set as a public variable
- [ ] `NEXT_PUBLIC_APP_URL` matches actual production domain exactly (no trailing slash)
- [ ] Redeploy after adding or changing any variable

---

## 3. Supabase Checklist

### Migrations

- [ ] Open Supabase SQL Editor
- [ ] Confirm all migrations have been applied (001 through 022)
- [ ] Run the following to verify key tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables include: `applicants`, `audit_logs`, `care_package_visits`, `care_packages`,
`clients`, `companies`, `compliance_items`, `documents`, `form_answers`, `form_fields`,
`form_responses`, `incidents`, `interviews`, `profiles`, `shifts`, `staff_availability`,
`staff_profiles`, `timesheets`, `visit_notes`.

### Company and Admin User

- [ ] At least one company row exists:

```sql
SELECT id, name FROM companies;
```

- [ ] Admin profile row exists and links to a valid auth user (see `docs/admin-auth-setup.md`):

```sql
SELECT p.id, p.role, p.email, c.name AS company
FROM profiles p
JOIN companies c ON c.id = p.company_id
WHERE p.role IN ('admin', 'company_admin', 'super_admin', 'coordinator');
```

- [ ] Test admin login manually at `/admin/login` — confirm redirect to `/admin` dashboard

### Storage

- [ ] Storage bucket named `care-os-documents` exists
- [ ] Bucket is set to **private** (not public)
- [ ] Confirm a test document upload works via the staff or applicant document UI

---

## 4. Smoke Test Script

Visit each URL on the production deployment. Mark pass or fail.

| URL | Expected result | Result |
|---|---|---|
| `/admin/login` | Login form renders, no errors in console | [ ] Pass / [ ] Fail |
| `/admin` | Dashboard loads, stats visible or empty state | [ ] Pass / [ ] Fail |
| `/admin/staff` | Staff list renders (empty or with data) | [ ] Pass / [ ] Fail |
| `/admin/clients` | Clients list renders | [ ] Pass / [ ] Fail |
| `/admin/care-packages` | Care packages list renders | [ ] Pass / [ ] Fail |
| `/admin/shifts` | Shifts list renders | [ ] Pass / [ ] Fail |
| `/admin/compliance` | Compliance alerts page renders | [ ] Pass / [ ] Fail |
| `/admin/audit-log` | Audit log renders (empty or with entries) | [ ] Pass / [ ] Fail |
| `/admin/incidents` | Incidents list renders | [ ] Pass / [ ] Fail |
| `/admin/visit-notes` | Visit notes list renders | [ ] Pass / [ ] Fail |

**Additional checks:**

- [ ] Navigate to a page, then click the browser back button — no crash
- [ ] Clicking Logout in the header redirects to `/admin/login`
- [ ] Visiting `/admin` while logged out redirects to `/admin/login`
- [ ] After login, the `redirect` query param is honoured (returns to original page)
- [ ] No `500` errors visible in the Vercel function logs

---

## 5. Core Workflow Test

Walk through each workflow end-to-end with real data before allowing others to use the system.

- [ ] **Create a client** — fill in name, address, funding type, risk level. Confirm row appears in client list.
- [ ] **Create a staff member** — use the direct create form or invite an applicant through the full flow.
- [ ] **Upload a document** — upload a PDF for a staff member or applicant. Confirm file appears in the document list and the download link works.
- [ ] **Complete compliance** — mark a compliance item as complete for a staff member. Confirm compliance percentage updates.
- [ ] **Set availability** — save availability for a staff member. Confirm it is reflected on the staff profile.
- [ ] **Create a care package** — link to a client, add visits. Confirm the package appears in the client's care package list.
- [ ] **Generate shifts** — run shift generation on a care package. Confirm shifts appear in the shifts list.
- [ ] **Assign a staff member to a shift** — confirm the assignment validates compliance and availability, updates shift status to `confirmed`.
- [ ] **Create a visit note** — link to a shift, fill in notes, submit. Confirm status changes to `submitted`.
- [ ] **Create an incident** — either from a visit note or directly. Confirm it appears in the incidents list with correct severity and status.
- [ ] **Check the audit log** — confirm recent actions appear with correct timestamps and entity references.

---

## 6. Controlled Pilot Rules

**Read these aloud with anyone who will use the system before going live.**

- **Do not use Care OS as the sole source of truth for payroll yet.** All hours and attendance must be cross-checked against your existing process.
- **Do not delete or replace existing care records.** Run Care OS in parallel with your current system (BrightHR or equivalent) until you are confident in the data.
- **Keep BrightHR / your existing HR process running in full.** Care OS does not replace payroll, holiday tracking, or HR workflows at this stage.
- **The worker portal is a pilot only.** Workers should be told this is a new system being tested. Do not use it as the primary communication channel for rotas or pay yet.
- **Verify all data manually for the first two weeks.** Cross-check staff profiles, shift records, and compliance statuses against paper or existing system records.

---

## 7. Known Limitations

Be aware of the following before going live:

| Limitation | Detail |
|---|---|
| **RLS not fully implemented** | Database-level row security is not yet enforced. Company isolation is handled in application code only. Do not share the platform with untrusted users. |
| **No rate limiting** | API routes have no rate limiting. Do not expose the admin panel to the public internet without basic access controls. |
| **Resend domain verification** | Invite and portal emails may land in spam or fail to deliver if your sending domain is not verified in Resend. Verify `INVITE_FROM_EMAIL` domain before inviting workers or applicants. |
| **Worker portal is MVP only** | Workers can view shifts and upload documents. Full scheduling, messaging, and swap requests are not built yet. |
| **No payroll or HMRC module** | Timesheet data exists but there is no payroll calculation, HMRC reporting, or export to accounting software. |
| **No CQC export pack** | The compliance data is structured but there is no one-click CQC inspection pack or report export yet. |

---

## 8. Emergency Rollback Plan

If Care OS has an outage or produces incorrect data during the pilot:

1. **Immediately revert to your existing manual process.** BrightHR, spreadsheets, or paper records remain the fallback. Do not wait for a fix before continuing operations.
2. **Do not delete any records in Care OS.** Even if data looks wrong, preserve it for investigation. Deletion cannot be undone.
3. **Pause new data entry in Care OS** until the issue is identified and resolved. Inform your team clearly.
4. **Document the issue.** Take a screenshot, note the exact time and the action that caused the problem, and send it to the developer with as much context as possible.
5. **Check Vercel function logs and Supabase logs** for error traces before any code changes are made.

---

## 9. Next-After-Go-Live Tasks

Once the platform is stable and running for at least one week, work through these in order:

| Priority | Task | Notes |
|---|---|---|
| High | **Rate limiting** | Add per-IP and per-user rate limits to API routes |
| High | **Row-level security (RLS)** | Enable RLS on all tables; replace service-role bypasses with JWT-scoped queries |
| High | **Resend domain verification** | Verify sending domain to ensure reliable email delivery |
| Medium | **Automated backups** | Configure Supabase point-in-time recovery; test restore procedure |
| Medium | **Export and reporting** | CSV or PDF exports for shift summaries, compliance status, and audit logs |
| Medium | **Worker portal hardening** | Token rotation, session expiry UI, push notifications for new shifts |
| Low | **Payroll and HMRC onboarding** | Timesheet → payroll export, P60/P45 data, HMRC RTI submission |
| Low | **CQC export pack** | One-click compliance report formatted for CQC inspection |
| Low | **Multi-company dashboard** | Super-admin view across all companies |
