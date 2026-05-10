---
name: RBAC implementation state
description: Permission layer added to Care OS — roles, guarded routes, future migration gap
type: project
---

RBAC layer implemented 2026-05-10.

**Why:** Production pilot approaching; all admin roles previously had identical access to every page and API.

**How to apply:** When adding new admin pages or API routes, follow the same pattern: `requireAdmin()` + `can(role, permission)`.

## Current role model

DB `user_role` enum: `super_admin | company_admin | coordinator | care_worker` (+ legacy `admin` alias)

Defined in `lib/auth/roles.ts`. Normalised by `normaliseRole()`.

## Permission layer

`lib/auth/permissions.ts` — pure, testable, no server-only. Exports `can(role, permission)` and `getRolePermissions(role)`.

| Permission area | super_admin | company_admin | coordinator | care_worker |
|---|---|---|---|---|
| applicants, staff:read, docs, compliance, clients:read, care_packages:read, shifts, incidents, visit_notes, timesheets, notifications | ✓ | ✓ | ✓ | ✗ |
| staff:write, clients:write, care_packages:write | ✓ | ✓ | ✗ | ✗ |
| audit_log:read, system:read | ✓ | ✓ | ✗ | ✗ |

## Page guards added

`requireAdmin()` + `can()` check at top of:
- `app/admin/audit-log/page.tsx` (server wrapper around `AuditLogContent.tsx`)
- `app/admin/system/page.tsx`
- `app/admin/staff/page.tsx`
- `app/admin/applicants/page.tsx`
- `app/admin/incidents/page.tsx`

Shows `<AccessDenied />` (components/admin/AccessDenied.tsx) on rejection.

## API guards added

Permission check added AFTER `requireAdmin()` in:
- `app/api/admin/audit-log/route.ts` — `audit_log:read`
- `app/api/admin/system/health/route.ts` — NOW REQUIRES AUTH + `system:read` (previously public)
- `app/api/admin/staff/[id]/documents/upload/route.ts` — `documents:upload`

## Navigation filtering

`app/admin/layout.tsx` fetches `role` from profiles, uses `can()` to show/hide nav links per role.

## Future migration gap

Task spec listed roles (company_owner, registered_manager, hr_admin, auditor, finance) that do NOT exist in the DB enum yet. Schema migration needed before these can be used. When migration lands, extend `ROLE_PERMISSIONS` in `lib/auth/permissions.ts` — no other file changes needed.

## Tests

- `tests/unit/permissions.test.ts` — 15 unit tests (tsx runner), `npm run test:unit`
- `tests/smoke/permissions.smoke.ts` — Playwright: page access + API happy path (local) + unauth 401 (staging only)

## Note on roles.ts

Removed `import 'server-only'` from `lib/auth/roles.ts` — it's pure logic with no server APIs. The server-only boundary is in `requireAdmin.ts`.
