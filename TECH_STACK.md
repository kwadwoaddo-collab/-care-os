# Care OS — Tech Stack

## Languages

| Language | Usage |
|----------|-------|
| TypeScript (strict mode) | Primary application language — all app, lib, and script code |
| JavaScript | Legacy utility scripts (`scripts/`, `supabase/`) |
| SQL | Supabase migrations (PostgreSQL DDL) |
| Python | QA helper scripts (`scripts/focus-mode-qa.py`, `occ-smoke-test.py`) |

---

## Frontend

| Technology | Version | Role |
|-----------|---------|------|
| **Next.js** | 16.2.4 | Full-stack React framework with App Router |
| **React** | 19.2.4 | UI rendering |
| **Tailwind CSS** | v4 | Utility-first CSS framework |
| `@tailwindcss/postcss` | v4 | Tailwind PostCSS integration |
| `react-signature-canvas` | 1.1.0-alpha | In-browser signature capture |
| View Transitions API | (experimental) | Animated page transitions via Next.js `experimental.viewTransition` |

---

## Backend / API

| Technology | Role |
|-----------|------|
| **Next.js App Router** API routes | REST endpoints under `app/api/` |
| `server-only` | Guards server-only modules from client bundle |
| `zod` v4 | Schema validation on API boundaries |
| Rate limiting | Custom `lib/rateLimit.ts` middleware |
| RBAC | Custom role-based access control (`lib/rbac/`, `lib/roles.ts`) |
| Feature flags | `lib/features.ts` |
| Structured logging | `lib/logger.ts` |

### Scheduled Jobs (Vercel Crons)
Defined in `vercel.json`, running daily:
- `/api/cron/compliance-sweep` — 06:00 UTC
- `/api/cron/compliance-reminders` — 07:00 UTC
- `/api/cron/anomaly-scan` — 08:00 UTC
- `/api/cron/comms-triggers` — 09:00 UTC
- `/api/cron/escalation-scan` — 10:00 UTC

---

## Database & Auth

| Technology | Version | Role |
|-----------|---------|------|
| **Supabase** | `@supabase/supabase-js` ^2.105.3 | PostgreSQL database, Auth, and Storage |
| `@supabase/ssr` | ^0.10.2 | Server-side rendering cookie-based auth |
| **PostgreSQL** | (Supabase-managed) | Relational database |
| `pgcrypto` | (Postgres extension) | Cryptographic functions in migrations |

Supabase clients are split by context:
- `lib/supabase/server.ts` — server-side (RSC / Route Handlers)
- `lib/supabase/browser.ts` — browser singleton
- `lib/supabase/client.ts` — shared typed client
- `lib/supabase/admin.ts` — service-role admin client

There are **60 SQL migration files** in `supabase/migrations/`.

---

## Document Generation

| Library | Version | Role |
|--------|---------|------|
| `pdf-lib` | ^1.17.1 | Programmatic PDF generation for compliance forms |

---

## Email

| Service | Version | Role |
|--------|---------|------|
| **Resend** | ^6.12.2 | Transactional email delivery |
| Custom templates | — | HTML email templates in `lib/notifications/templates/` |

---

## Build & Tooling

| Tool | Version | Role |
|-----|---------|------|
| **pnpm** | (workspace) | Package manager (`pnpm-workspace.yaml`) |
| **tsx** | ^4.21.0 | TypeScript script execution (for `scripts/`, `tests/unit/`) |
| `tslib` | ^2.8.1 | TypeScript runtime helpers |
| ESLint | ^9 + `eslint-config-next` | Linting |
| PostCSS | via `@tailwindcss/postcss` | CSS processing |

---

## Testing

| Tool | Version | Role |
|-----|---------|------|
| **Playwright** | ^1.59.1 | End-to-end / smoke tests |
| Custom unit test runner | (tsx) | Unit tests executed via `tsx` directly — no Jest/Vitest |

### Test structure
- `tests/unit/` — 13 unit test files (permissions, compliance, scheduling, RBAC, etc.)
- `tests/smoke/` — 14 smoke test files (auth, onboarding, compliance, worker portal, cron, etc.)
- `tests/fixtures/` — shared test fixtures

Playwright is configured with multi-project support: `chromium`, `firefox`, `mobile-chrome`, worker portal variants, and auth flow tests.

---

## Deployment

| Service | Role |
|--------|------|
| **Vercel** | Hosting, edge functions, and cron scheduling |
| Vercel Crons | Scheduled compliance and notification sweeps |
| Supabase | Managed Postgres + Auth + Storage (cloud) |

---

## Security

Enforced via `next.config.ts` security headers on all routes:
- `Content-Security-Policy` (CSP)
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, mic, geo, payment, USB all denied)
- `X-DNS-Prefetch-Control`
- Production source maps disabled

---

## Notable Dependencies Summary

```
Production
├── next@16.2.4
├── react@19.2.4 + react-dom@19.2.4
├── @supabase/supabase-js@^2.105.3
├── @supabase/ssr@^0.10.2
├── zod@^4.4.3
├── pdf-lib@^1.17.1
├── resend@^6.12.2
├── react-signature-canvas@^1.1.0-alpha.2
├── server-only@^0.0.1
├── tslib@^2.8.1
└── ws@^8.20.0

Dev / Tooling
├── typescript@^5
├── tailwindcss@^4 + @tailwindcss/postcss@^4
├── @playwright/test@^1.59.1
├── tsx@^4.21.0
├── eslint@^9 + eslint-config-next@16.2.4
└── dotenv@^17.4.2
```
