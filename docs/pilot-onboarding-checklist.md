# Pilot Onboarding Checklist

Use this checklist when onboarding a new care company as a Care OS pilot tenant.

---

## Phase 1: Pre-Onboarding (Before First Login)

### Technical Setup
- [ ] Create the company record in Supabase (`companies` table: `name`, `slug`)
- [ ] Confirm `NEXT_PUBLIC_APP_URL` is set to the correct deployment URL
- [ ] Confirm `RESEND_API_KEY` and `EMAIL_FROM` are configured
- [ ] Verify the deployment is healthy (`/admin/system` → System Health: all green)
- [ ] Confirm the migration version is up to date (no mismatch in diagnostics)

### Access Setup
- [ ] Create the first `company_admin` user via Supabase Auth (invite or set password)
- [ ] Send the admin login link: `[APP_URL]/admin/login`
- [ ] Confirm the admin can log in and sees the correct company name
- [ ] Verify the QA/pilot banner is shown (if applicable)

---

## Phase 2: Tenant Configuration (Super Admin)

Access via: `/admin/system/tenants/[id]`

### Setup Wizard
- [ ] Complete Step 1: Set display name
- [ ] Complete Step 2: Upload logo, set accent colour, add tagline
- [ ] Complete Step 3: Set branded email from address
- [ ] Complete Step 4: Confirm timezone (default: Europe/London) and hours limits
- [ ] Complete Step 5: Review compliance expiry defaults (DBS, RTW, training)
- [ ] Complete Step 6: Confirm onboarding requirements (DBS, RTW, references, etc.)
- [ ] Complete Step 7: Confirm shift/overtime rules
- [ ] Complete Step 8: Set notification preferences, flag as Pilot, set Go Live date
- [ ] Setup wizard marked as complete (green checkmark on tenant detail)

### Branding Review
- [ ] Logo displays correctly in preview
- [ ] Accent colour matches company branding
- [ ] Login tagline is appropriate
- [ ] Branded email from is verified in Resend sender list

### Configuration Review
- [ ] Compliance thresholds match regulatory requirements
- [ ] Blocking rules are appropriate for the company's risk appetite
- [ ] Escalation timings agreed with registered manager

---

## Phase 3: Data Preparation

### Demo Data (Optional)
- [ ] Generate demo data via `/api/admin/system/tenants/demo`
- [ ] Confirm `[DEMO]` tagged records are visible in applicants and staff
- [ ] Walk company admin through demo data to demonstrate the platform
- [ ] Clean demo data before go-live (`[DEMO]` records can be deleted via script)

### Real Data
- [ ] First applicants created (or invited via magic link)
- [ ] At least one staff member in pre_employment status
- [ ] Compliance checklist reviewed with HR/compliance lead

---

## Phase 4: Pilot Launch Validation

Run from: `/admin/system/tenants/[id]` → Go Live Readiness Score

### Readiness Score Targets
- [ ] Score ≥ 80 before go-live
- [ ] Zero critical issues
- [ ] Zero blocked staff
- [ ] Zero safeguarding alerts
- [ ] Onboarding backlog is acceptable
- [ ] Stale applicant count reviewed

### Compliance Check
- [ ] At least 1 staff member is fully compliant (all items = complete)
- [ ] Compliance dashboard accessible to registered manager
- [ ] Expiry warning emails tested and delivering

### Operational Check
- [ ] Admin can create and assign shifts
- [ ] Staff can log into the worker portal
- [ ] Documents can be uploaded and approved
- [ ] Audit log is recording actions

---

## Phase 5: Handover & Go Live

### Final Sign-Off
- [ ] Registered manager has accepted the platform
- [ ] Go Live date set in tenant config
- [ ] Pilot mode flag remains enabled until full launch
- [ ] Support contact communicated to company admin

### Post-Launch Monitoring (Week 1)
- [ ] Run diagnostics check after 3 days (`/admin/system/tenants/[id]/diagnostics`)
- [ ] Review failed notifications count (target: 0)
- [ ] Review queue backlog (target: 0)
- [ ] Confirm compliance data is being entered (check onboarding backlog)
- [ ] Check compliance risk level (target: low)
- [ ] Review Go Live Readiness Score weekly

---

## Quick Reference

| URL Pattern | Purpose |
|-------------|---------|
| `/admin/system/tenants` | All tenants list |
| `/admin/system/tenants/[id]` | Tenant health & readiness |
| `/admin/system/tenants/[id]/setup` | Setup wizard |
| `/admin/system/tenants/[id]/branding` | Logo, colour, tagline |
| `/admin/system/tenants/[id]/config` | Compliance & operational config |
| `/admin/system/tenants/[id]/diagnostics` | DB, jobs, record health |

---

## Escalation Contacts

> Add your internal support escalation contacts here before sharing with pilot companies.

| Issue | Contact |
|-------|---------|
| Auth / login problems | Super admin |
| Compliance data questions | Registered manager |
| Technical/platform issues | Care OS support |

---

## Notes

- All tenant data is fully isolated by `company_id` — pilot tenants cannot see each other's data.
- The QA environment banner (`QA Environment`) is shown when the company name contains "QA".
- The Pilot mode banner is shown when `is_pilot = true` in `tenant_config`.
- Demo data can be regenerated at any time; all `[DEMO]` records are safe to delete.
