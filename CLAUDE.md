# CLAUDE.md

## Project Overview
Care OS — a SaaS onboarding and compliance platform for UK care companies (domiciliary care, supported living, children’s homes).

This system manages the full lifecycle of a worker:
Applicant → Interview → Onboarding → Fully compliant staff

The goal is to replace paper/PDF onboarding with structured digital workflows and produce audit-ready staff records.

---

## Core Objective
Ensure every staff member has a complete compliance file.

The system must clearly show:
- What is complete
- What is missing
- What is expiring soon

---

## Key Concept
Each staff member has a digital staff file including:
- Application data
- Interview notes
- Compliance checks
- Contracts and agreements
- Training records
- Uploaded documents

The system must provide a single audit view per staff member.

---

## Core Workflow

### 1. Applicant Stage
- Magic link access
- Completes application form
- Creates applicant profile

### 2. Review Stage
- Admin reviews
- Shortlist or reject

### 3. Interview Stage
- Record notes and scores
- Decision: hire or reject

### 4. Pre-employment Checks
Tracked items:
- DBS
- Right to work
- References
- ID verification

Statuses:
- Not started
- In progress
- Complete
- Rejected

### 5. Onboarding
- Applicant becomes staff
- Completes forms
- Uploads documents
- Signs agreements

### 6. Compliance Tracking
Tracks:
- Documents
- Contracts
- Policies
- Training

Includes expiry tracking and alerts.

---

## Forms System (IMPORTANT)
All forms must be built as structured HTML forms.

Each field must support:
- Label
- Input type (text, date, checkbox, file upload)
- Toggle: include in PDF or not

Forms must:
- Save responses to database
- Generate clean PDF (label left, answer right)
- Be reusable

---

## User Roles
- Admin
- Staff
- Applicant (magic link)

---

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Supabase (DB, Auth, Storage)
- Vercel (hosting)

---

## Development Principles
- Build in phases (MVP first)
- Focus only on onboarding and compliance
- No payroll or timesheets
- Keep things simple and modular
- Do not generate entire app at once
- Always propose before implementing

---

## Claude Behaviour
- Do not re-read files already read earlier in the current conversation unless there is reason to believe they changed.
- Trust in-context file state from earlier in the same session.
- Do not narrate a "let me read all relevant files first" phase — just start working.
- Do not repeat analysis or file contents that are already in context.

---

## Commands
bash npm run dev npm run build npm run start npm run lint 

---

## Project Structure
- app/ — App Router pages and layouts
- public/ — static assets
- next.config.ts — Next.js configuration
- tsconfig.json — TypeScript configuration
- postcss.config.mjs — Tailwind/PostCSS configuration