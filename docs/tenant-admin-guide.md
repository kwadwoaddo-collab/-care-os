# Tenant Administration Guide

## Overview

The Tenant Administration panel (`/admin/system/tenants`) is accessible only to `super_admin` users. It provides full visibility and control over every care company (tenant) onboarded to Care OS.

---

## Access

| Role          | Access |
|---------------|--------|
| super_admin   | Full access to all tenant admin features |
| company_admin | Cannot access — tenant-scoped only |
| All others    | No access |

The tenant admin area is intentionally restricted to super_admin to prevent any cross-tenant data leakage.

---

## Tenant List (`/admin/system/tenants`)

Displays all registered companies with:

- **Company name & slug** — identifies the tenant
- **Active / Pilot status** — whether the tenant is live or in pilot mode
- **Setup progress** — percentage completion of the onboarding wizard
- **Admin count** — number of users with admin-level roles
- **Staff count** — active + pre_employment staff (applicant count shown separately)
- **Compliance risk** — low / medium / high / critical, based on expired compliance items
- **Storage estimate** — approximate MB used (based on document count)
- **Created date** — when the company was first registered

---

## Tenant Detail (`/admin/system/tenants/[id]`)

The detail view shows:

### Go Live Readiness Score (0–100)

A composite score that penalises:
- Critical issues and safeguarding alerts (heaviest penalty)
- Blocked staff from expired compliance
- Uncovered shifts
- Stale onboarding backlog

A score ≥ 80 = Ready to go live. Score < 60 = Action required.

### Onboarding Checklist

Tracks key setup milestones:
1. Company details set
2. Branding configured
3. Compliance defaults reviewed
4. Timezone set
5. Admin user created
6. Setup wizard completed
7. Go Live date scheduled
8. Demo data generated

### Health Cards

Real-time counts for:
- Critical issues, blocked staff, uncovered shifts
- Safeguarding alerts, open incidents
- Onboarding backlog and stale applicants
- Expiring compliance items

---

## Setup Wizard (`/admin/system/tenants/[id]/setup`)

An 8-step guided wizard to configure a new tenant:

| Step | Title                  | Key Fields |
|------|------------------------|------------|
| 1    | Company Details        | Display name |
| 2    | Logo & Branding        | Logo URL, accent colour, login tagline |
| 3    | Contact & Email        | Branded email from address |
| 4    | Timezone & Schedule    | Timezone, max weekly hours, shift gap |
| 5    | Compliance Defaults    | DBS/RTW expiry days, warning/critical periods |
| 6    | Role Structure         | Onboarding requirements (DBS, RTW, references, etc.) |
| 7    | Shift & Overtime Rules | Overtime threshold, blocking rules |
| 8    | Notifications          | Notification preferences, pilot flag, go live date |

Each step is saved individually. Progress is persisted — the wizard can be resumed.

---

## Branding (`/admin/system/tenants/[id]/branding`)

Configures the visual identity for a tenant:

- **Company name** — display override (e.g. "Sunrise Care Ltd")
- **Logo URL** — publicly accessible image (PNG or SVG)
- **Accent colour** — used throughout the branded portal (hex colour)
- **Email from** — branded sender address for outgoing emails
- **Login tagline** — shown below the company name on the login screen

A live preview updates in real-time as fields are changed.

---

## Configuration Engine (`/admin/system/tenants/[id]/config`)

All compliance, escalation, blocking, and notification settings are configurable per-tenant:

### Compliance Thresholds
- DBS expiry days (default 1095 = 3 years)
- Right to Work expiry days (default 730 = 2 years)
- Training expiry days (default 365)
- Warning period: days before expiry to trigger warning alerts
- Critical period: days before expiry for critical alerts

### Escalation Timings
- Unresolved issue escalation: hours before automatic escalation
- Critical incident escalation: hours for urgent flags

### Assignment Blocking Rules
- Block non-compliant staff from shifts
- Block staff with expired DBS
- Block staff with expired Right to Work

### Onboarding Requirements
- Require DBS, RTW, references, ID verification, contract signature

### Shift & Overtime Rules
- Maximum weekly hours (default 48, per Working Time Regulations)
- Overtime threshold hours
- Minimum shift gap (default 11 hours, per WTR)

### Notification Preferences
- Email and in-app alerts for expiring documents
- Email alerts for safeguarding incidents
- Stale onboarding alerts

### Override Permissions
- Allow compliance override by registered managers
- Allow shift assignment override

---

## Health Monitoring (`/admin/system/tenants/[id]`)

Health data is fetched live (no-store cache) and includes:

- `critical_issues` — expired compliance + safeguarding alerts
- `blocked_staff` — staff with expired compliance items
- `uncovered_shifts` — scheduled shifts with no assigned staff
- `compliance_risk_level` — low/medium/high/critical
- `safeguarding_alerts` — high/critical severity open incidents
- `onboarding_backlog` — pre_employment staff >30 days old
- `stale_applicants` — applied/shortlisted >60 days old
- `open_incidents` — unresolved incident count
- `expiring_soon` — compliance items expiring in <30 days

---

## Support & Diagnostics (`/admin/system/tenants/[id]/diagnostics`)

Provides low-level operational insight:

| Check | Description |
|-------|-------------|
| Applied migrations | How many DB migrations have been applied |
| Migrations mismatch | Whether applied count differs from expected |
| Last activity | Most recent audit log entry for the tenant |
| Failed notifications | Count of failed notification deliveries |
| Queue backlog | Operations queue items unresolved >7 days |
| Stale records | Not-started compliance items >90 days old |
| Profiles without staff record | Auth profiles missing a staff_profile row |
| Orphaned documents | Documents with no staff link |
| Duplicate emails | Staff records sharing the same email |

---

## Tenant Isolation

Tenant isolation guarantees:

1. **No cross-tenant data access** — all queries are scoped by `company_id`
2. **Tenant context always visible** — the tenant name is shown in all detail views
3. **Tenant switching restricted** — only super_admin can switch context via the tenant admin panel
4. **Audit logs are tenant-scoped** — every action records the `company_id`
5. **RLS on new tables** — `tenant_branding` and `tenant_config` use service-role-only RLS policies

---

## Demo Data Generator

POST `/api/admin/system/tenants/demo` with `{ company_id }`.

Generates:
- 3 applicants (applied, shortlisted, interview_scheduled)
- 4 staff profiles (2 active, 2 pre_employment)
- 3 clients (active, active, prospective)

All records are tagged with `[DEMO]` in the first_name field for easy identification and cleanup.

---

## Database Schema

New tables added in migration `047_tenant_administration.sql`:

### `tenant_branding`
Stores per-tenant visual identity. One row per company (UNIQUE on `company_id`).

### `tenant_config`
Stores per-tenant operational configuration. One row per company (UNIQUE on `company_id`). Both tables are upserted on save — no need for separate create/update flows.

Both tables use RLS with service-role-only policies. The admin client (service role) bypasses RLS for all reads and writes.
