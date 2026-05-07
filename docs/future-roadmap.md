# SprintScale IT SaaS Ecosystem Roadmap

> **Last Updated:** May 2026  
> **Status:** Living Document — update continuously as the platform evolves.

---

## Vision

SprintScale IT (`sprintscaleit.co.uk`) is the parent company and brand umbrella for a growing suite of vertical SaaS products. Each product targets a specific operational domain, shares infrastructure and authentication primitives, and is delivered as a subdomain under the parent brand.

Care OS is the **first product** in this ecosystem — a full care management platform for UK domiciliary and residential care providers. It serves as the foundation pattern for all future products.

### Planned SaaS Products

| Product | Domain | Status |
|---|---|---|
| **Care OS** | `care.sprintscaleit.co.uk` | Active — pre-launch |
| **HR OS** | `hr.sprintscaleit.co.uk` | Planned |
| **Education OS** | `education.sprintscaleit.co.uk` | Migration pending |
| **Recruitment OS** | `recruitment.sprintscaleit.co.uk` | Planned |
| **Compliance OS** | `compliance.sprintscaleit.co.uk` | Planned |
| **Operations Dashboard** | `ops.sprintscaleit.co.uk` | Concept |
| **AI Tooling Suite** | `ai.sprintscaleit.co.uk` | Future concept |

### Parent Architecture

```
sprintscaleit.co.uk                  → Parent company website (marketing + login portal)
care.sprintscaleit.co.uk             → Care OS
education.sprintscaleit.co.uk        → Education OS
hr.sprintscaleit.co.uk               → HR OS
recruitment.sprintscaleit.co.uk      → Recruitment OS
```

### Why This Structure?

- **Professionalism:** Subdomains project enterprise-level credibility and make onboarding feel product-specific.
- **Isolation:** Each product can be deployed, scaled, and maintained independently with no cross-contamination of concerns.
- **Shared Identity:** All products share a recognisable parent brand — `sprintscaleit.co.uk` — which builds trust and cross-sell opportunities.
- **SEO & Marketing:** Each subdomain can build its own SEO authority while benefiting from the parent domain's reputation.
- **Tenant Routing:** Subdomains make multi-tenant routing clean and deterministic without cluttering path-based routes.

---

# Multi-Tenant SaaS Strategy

## Core Model

Care OS (and all future products) follow a **shared-codebase, multi-tenant architecture**. There is one deployed codebase serving many companies simultaneously. Tenant data is isolated by `company_id` enforced at the database, API, and middleware layers.

### Tenant Isolation Principles

- Every database table that holds business data carries a `company_id` foreign key.
- Every API route reads `company_id` from the authenticated session — never from user input.
- Middleware resolves the tenant on every request before any handler runs.
- Row-Level Security (RLS) will be the final enforcement layer in Supabase once fully rolled out.

### Subdomain-Based Tenant Routing

Each company gets a subdomain under the product domain:

```
caresupreme.care.sprintscaleit.co.uk
abc-care.care.sprintscaleit.co.uk
goldenhands.care.sprintscaleit.co.uk
```

Middleware reads the subdomain prefix, resolves it to a `company_id` in the database, and injects the tenant context into every request.

### Future: Custom Domains

High-tier customers may bring their own domain:

```
portal.caresupremeltd.co.uk  →  resolves to Care OS for company_id: 42
```

This requires:
- Cloudflare custom hostname API integration
- SSL provisioning per domain (Cloudflare handles this automatically)
- A `custom_domains` table mapping domain → `company_id`

### Future: White-Label Mode

Enterprise customers can run a fully white-labelled instance with:
- Custom logo and colour scheme stored per company
- No SprintScale branding visible in the UI
- Custom email sender domain via Resend domain verification

---

# Current Care OS Status

## ✅ Completed

The following systems are implemented and considered feature-complete for the initial go-live:

- **Authentication** — Supabase Auth with session management, protected routes, and role-based access
- **Middleware** — Tenant detection, session validation, and company isolation on all API routes
- **Company Isolation** — `company_id` enforcement across all data models
- **Staff Management** — Full CRUD, status management, compliance gating
- **Client Management** — Client profiles, needs assessment, status tracking
- **Care Packages** — Package creation, assignment, and management
- **Shifts** — Shift scheduling, assignment, and status lifecycle
- **Incidents** — Incident logging, categorisation, and escalation tracking
- **Audit Log** — Append-only activity log across all key entities
- **Compliance Engine** — Document expiry tracking, compliance status calculation, expiry alerts
- **HR Onboarding Fields** — Structured applicant portal with JSONB sections (employment history, training, declarations)
- **Pagination & Filtering** — Standardised cursor/offset pagination across all list views
- **Admin Dashboard** — Overview metrics, recent activity, compliance widgets
- **Upload Validation** — File type and size validation on upload endpoints
- **Visit Notes** — Per-shift visit note creation and retrieval
- **Timesheets** — Timesheet generation and approval workflow
- **Worker Portal MVP** — Staff-facing portal for availability, shifts, and profile

---

## 🔲 Before Internal Go-Live

Tasks that must be completed before the first internal pilot deployment:

- [ ] Production deployment to Vercel (production environment)
- [ ] Domain DNS setup — `care.sprintscaleit.co.uk` pointing to production
- [ ] SSL certificate verification on production domain
- [ ] Seed data cleanup — remove all test/demo data from production database
- [ ] Supabase Storage bucket verification — correct policies and access controls
- [ ] Resend email verification — confirm domain is verified and transactional emails deliver
- [ ] Pilot staff onboarding — walk at least one real staff member through the portal
- [ ] Backup procedures — verify Supabase daily backups are enabled and tested
- [ ] Server log review — confirm no unexpected errors in production logs
- [ ] Cross-browser and cross-device testing — Chrome, Safari, Firefox, iOS, Android

---

## 🔲 Before Public SaaS Launch

Tasks that must be completed before the platform is open to paying customers:

- [ ] API rate limiting — prevent abuse on all public and authenticated endpoints
- [ ] Row-Level Security (RLS) — complete RLS rollout across all Supabase tables
- [ ] Billing system — Stripe integration for subscription management
- [ ] Stripe subscriptions — per-company subscription plans with webhook handling
- [ ] Company self-signup — public registration flow for new companies
- [ ] Usage quotas — per-plan limits on staff count, client count, storage, etc.
- [ ] Analytics — PostHog integration for usage tracking and funnel analysis
- [ ] Onboarding wizard — guided setup flow for new companies post-signup
- [ ] Support desk — Intercom or similar for in-app customer support
- [ ] SLA monitoring — uptime monitoring with alerting (e.g. BetterStack)
- [ ] Email queues — background email sending with retry logic (Resend + Trigger.dev)
- [ ] Production observability — Sentry error tracking, logging pipeline
- [ ] Security audit — internal review of all API routes, auth flows, and data access
- [ ] Penetration testing — third-party or automated pen test before launch

---

# Education App Migration Plan

## Current State

The Education OS application currently lives on the **root domain** (`sprintscaleit.co.uk` or a standalone domain). It is live and serving real users who depend on it for bookings, payments, and communications.

## Target State

```
education.sprintscaleit.co.uk
```

## Why This Migration Is Necessary

- The root domain needs to become the SprintScale IT **parent company website** (marketing, product listings, login portal).
- Education OS should sit alongside Care OS as a peer product, not occupy the root domain.
- This enables consistent branding, subdomain routing, and multi-tenant patterns across all products.

## Migration Phases

### Phase 1 — Clone and Deploy
- Clone the education app codebase.
- Set up a new Vercel project pointing to `education.sprintscaleit.co.uk`.
- Configure all environment variables (database, storage, payment keys) in the new project.
- Deploy to the new subdomain in **parallel** — do not touch the existing live deployment.

### Phase 2 — Test Authentication
- Verify all authentication flows work on the new domain.
- Confirm session cookies scope correctly to the new subdomain.
- Test login, logout, password reset, and email confirmation flows.

### Phase 3 — Test Uploads, Payments, and Integrations
- Verify Supabase Storage access from the new domain.
- Confirm Stripe payment flows complete successfully.
- Test all email notifications (Resend/SMTP).
- Verify any third-party integrations or webhooks point to the correct new URL.

### Phase 4 — Gradual Redirect Rollout
- Add a banner on the old domain informing users of the upcoming move.
- Begin a soft redirect period — links in emails and communications updated to the new domain.
- Monitor for broken journeys or user confusion.
- Once traffic drops significantly on old domain, implement a hard `301` redirect.

### Phase 5 — Convert Root Domain
- Remove the education app from the root domain.
- Replace the root domain with the SprintScale IT parent company website.
- Ensure all old deep-links are redirected to their correct new paths.

> ⚠️ **WARNING:** Do NOT rush this migration. Real users are live on the current deployment. A botched migration would break active bookings, payments, and parent communications. Each phase must be fully tested before proceeding to the next.

---

# Future Infrastructure Architecture

## Vercel Architecture (Production)

- **Monorepo or per-product repos** deployed as separate Vercel projects.
- Each product gets its own production, staging, and preview environments.
- Environment variables managed per-project in Vercel dashboard (no shared `.env` across products).
- Edge Middleware for tenant resolution at the CDN layer.
- Vercel Analytics for Core Web Vitals monitoring.

## Supabase Scaling

- **Current:** Shared Supabase project for Care OS.
- **Near-term:** Separate Supabase projects per product (Care OS, Education OS, etc.) for isolation.
- **Long-term:** Evaluate Supabase Enterprise or self-hosted Postgres for large enterprise customers.
- Enable Point-in-Time Recovery (PITR) on all production projects.
- Connection pooling via Supabase PgBouncer for high-traffic scenarios.

## Background Jobs, Queues & Cron

| Concern | Planned Tool |
|---|---|
| Background jobs | Trigger.dev |
| Scheduled cron tasks | Trigger.dev scheduled jobs |
| Email queues | Resend + Trigger.dev |
| File processing / async uploads | Trigger.dev |
| Payroll batch processing | Trigger.dev (future) |

## Monitoring & Observability

| Concern | Planned Tool |
|---|---|
| Error tracking | Sentry |
| Uptime monitoring | BetterStack or UptimeRobot |
| Application logging | Axiom or Logtail |
| User analytics | PostHog |
| Performance monitoring | Vercel Analytics + Sentry Performance |

## Planned Production Stack

```
Next.js (Vercel)         → Application framework and hosting
Supabase                 → Database, Auth, Storage, Realtime
Upstash Redis            → Caching, rate limiting, session storage
Trigger.dev              → Background jobs, queues, cron
Stripe                   → Billing and subscriptions
Resend                   → Transactional email
PostHog                  → Product analytics
Sentry                   → Error tracking and performance monitoring
Cloudflare               → DNS, CDN, DDoS protection, custom domains
```

---

# Security Roadmap

## Row-Level Security (RLS)

- [ ] Audit all Supabase tables for missing RLS policies
- [ ] Enable RLS on every table that holds tenant data
- [ ] Write and test policies for `select`, `insert`, `update`, `delete` on each table
- [ ] Remove remaining service-role client usage from frontend/API routes where RLS can replace it

## Authentication & Sessions

- [ ] Multi-Factor Authentication (MFA) — enforce for admin roles, optional for staff
- [ ] Session expiry — configurable per-company session timeout
- [ ] Idle session detection with automatic logout on inactivity
- [ ] Refresh token rotation with secure storage

## API Security

- [ ] API rate limiting — per-IP and per-user limits using Upstash Redis
- [ ] CSRF protection — verify all state-mutating routes are protected
- [ ] Input validation — centralised Zod schema validation on all API routes
- [ ] IP and device tracking for suspicious login detection

## Audit & Compliance

- [ ] Expand audit log to cover all data mutations (currently covers key actions only)
- [ ] Audit log export — allow compliance officers to download audit logs
- [ ] Data retention policies — configurable per-company retention rules
- [ ] GDPR right-to-erasure tooling — soft delete + hard delete pipeline for personal data

## Infrastructure Security

- [ ] Signed upload URLs — remove direct public upload access from all storage buckets
- [ ] Secrets rotation schedule — rotate Supabase keys, Stripe keys, and API secrets quarterly
- [ ] Backup verification — monthly restore test from Supabase backups
- [ ] Dependency auditing — automated `npm audit` in CI pipeline

---

# Commercial SaaS Roadmap

## Billing Model

Care OS (and future products) will operate on a **per-company subscription** model. Billing is handled entirely through Stripe.

### Subscription Tiers (Planned)

| Tier | Description |
|---|---|
| **Starter** | Small teams, limited staff/clients, basic features |
| **Growth** | Mid-size companies, full feature access, priority support |
| **Enterprise** | Unlimited users, custom domains, white-label, dedicated SLA |

### Commercial Features Roadmap

- [ ] Stripe subscription integration — per-company recurring billing
- [ ] Billing portal — self-service plan management and invoice downloads
- [ ] Per-company feature flags — enable/disable features by plan tier
- [ ] Usage quotas — enforce limits on staff count, clients, storage per plan
- [ ] Invoice generation — PDF invoices for each billing period
- [ ] White-label plans — remove SprintScale branding for enterprise customers
- [ ] Custom branding per company — logo, colours, email sender name
- [ ] Custom domains per company — bring-your-own-domain support
- [ ] Reseller mode — allow agencies to provision companies on behalf of clients
- [ ] Enterprise mode — SSO, dedicated support, custom SLA agreements

### Self-Signup Flow (Planned)

1. Company lands on `care.sprintscaleit.co.uk`
2. Clicks "Start Free Trial"
3. Enters company details, selects plan
4. Stripe payment captured (or trial started)
5. Company record created, subdomain provisioned
6. Onboarding wizard guides initial setup
7. First admin user invited via email

---

# HMRC + Payroll Future Module

> **Phase:** Post-stability build — do not begin until Care OS is in stable public production.

This module will transform Care OS into a fully integrated workforce management and payroll platform, removing the need for separate payroll software for small-to-medium care providers.

## Planned Payroll Features

- [ ] **Payroll Engine** — calculate gross pay, tax (PAYE), National Insurance, pension deductions per employee per pay period
- [ ] **RTI Submissions** — Full Payment Submissions (FPS) and Employer Payment Summaries (EPS) to HMRC via PAYE Online API
- [ ] **Pension Exports** — auto-enrolment exports compatible with NEST, People's Pension, and other providers
- [ ] **P60 Generation** — end-of-year P60 production for all employees
- [ ] **P45 Generation** — P45 on employee termination
- [ ] **Payslips** — PDF payslip generation and delivery via email or worker portal
- [ ] **Payroll Approval Workflow** — manager review and sign-off before payroll is finalised
- [ ] **Accounting Exports** — CSV/XLSX exports compatible with Xero, QuickBooks, and Sage

> ⚠️ **This is a post-stability build phase.** HMRC integrations carry regulatory risk and must not be built until the core platform is stable, tested, and running in production.

---

# CQC + Care Compliance Roadmap

Care OS will evolve into a **CQC-inspection-ready** platform. The goal is that any care company using Care OS can walk into an inspection with confidence that their records are complete, organised, and evidenced.

## Planned Compliance Features

- [ ] **One-Click Inspection Pack** — generate a complete, formatted PDF bundle of all relevant records for a CQC inspection
- [ ] **Medication Logs** — structured medication administration records (MAR charts)
- [ ] **MAR Charts** — digital medication administration records per client per medication
- [ ] **Risk Assessments** — templated risk assessments per client (falls, pressure sores, nutrition, etc.)
- [ ] **Safeguarding Records** — secure safeguarding concern logging and escalation tracking
- [ ] **Training Expiry Workflows** — automated alerts when staff training (manual handling, first aid, etc.) is due to expire
- [ ] **Supervision Tracking** — log and schedule one-to-ones and formal supervisions for all staff
- [ ] **Care Plan Reviews** — scheduled care plan review reminders and sign-off tracking
- [ ] **Incident Escalation Workflows** — structured escalation paths for serious incidents (RIDDOR, safeguarding, CQC Duty of Candour)

---

# Technical Debt / Known Gaps

> This section is a running checklist. Add items as they are discovered. Remove or mark complete as they are resolved.

## Refactoring

- [ ] Centralise API error handling — standardise error response shapes across all routes
- [ ] Remove duplicated `company_id` resolution logic — extract to a shared middleware utility
- [ ] Standardise pagination — ensure all list endpoints use the same pagination pattern

## Security / Data Access

- [ ] Audit all remaining uses of Supabase service-role client in API routes
- [ ] Replace service-role usage with RLS-compatible queries where possible
- [ ] Identify all tables still missing RLS policies and create a remediation plan

## Worker Portal

- [ ] Worker portal shift acceptance/rejection flow
- [ ] Worker portal availability submission
- [ ] Worker portal payslip access (future, linked to payroll module)
- [ ] Push notifications for shift changes (future)

## Reporting

- [ ] Company-level reporting dashboard — hours worked, incident rates, compliance scores
- [ ] Exportable reports — CSV/PDF export for all major data views
- [ ] Date-range filtering on all report views

## Mobile

- [ ] Mobile optimisation audit — identify and fix UI breakpoints across all admin views
- [ ] Worker portal mobile-first redesign — staff primarily access on mobile devices
- [ ] Progressive Web App (PWA) capability for offline-capable worker portal (future)

## Testing

- [ ] Unit test coverage for all utility functions and compliance calculation engine
- [ ] Integration tests for all critical API routes
- [ ] End-to-end tests for key user journeys (login, shift creation, incident logging)

---

# Future Product Ideas

A brainstorm of potential future SaaS products under the SprintScale IT umbrella. These are ideas only — no commitments.

| Idea | Description |
|---|---|
| **Recruitment OS** | End-to-end recruitment platform: job posting, applicant tracking, interviews, offers, onboarding — sector-agnostic but with vertical templates for care and education |
| **HR OS** | Standalone HR platform covering contracts, leave management, disciplinary processes, performance reviews, and staff handbooks |
| **Education OS** | Full school/club management: registrations, bookings, invoicing, attendance, OFSTED-ready reporting |
| **Timesheet OS** | Lightweight timesheet and invoicing tool for freelancers and small agencies — simpler alternative to Harvest or Toggl |
| **Inspection OS** | Cross-sector compliance and inspection readiness platform — connects to CQC, OFSTED, ISO standards |
| **Onboarding OS** | White-label staff onboarding platform — digital contracts, right-to-work checks, ID verification, e-signatures |
| **AI Document Assistant** | AI-powered tool for generating care plans, risk assessments, and compliance documents from structured inputs |
| **Scheduling OS** | Sector-agnostic shift scheduling and rota management with SMS/WhatsApp notifications |
| **Payroll OS** | Standalone payroll engine (extracted from Care OS payroll module) for small UK businesses |
| **Forms OS** | Drag-and-drop form builder with submission management, conditional logic, and PDF output — for care assessments, HR forms, and education registrations |

---

# Notes

> This document is intentionally long-term and strategic. It should be continuously updated as the platform evolves. Not all items listed here represent committed work — many are directional intentions subject to reprioritisation based on customer feedback, market conditions, and technical feasibility.

**Principles to uphold:**
- Stability before features. A reliable platform for current users always takes priority over new functionality.
- Tenant isolation is non-negotiable. Every feature must respect `company_id` boundaries.
- Security is not a phase. RLS, rate limiting, and audit logging must be shipped before public launch.
- Don't rush migrations. Live users on the education app and future live customers must never experience disruption from internal structural changes.
- Build for scale from the start. Decisions made today in schema, routing, and billing architecture will be expensive to reverse at scale.

---

*Document maintained by SprintScale IT engineering. Review and update at the start of each major development phase.*
