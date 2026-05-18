# Staff Document Governance Architecture

## Overview

The Care OS enterprise document governance system provides a BrightHR-replacement document management layer with structured folders, role-based visibility, versioning, expiry automation, and full audit trails.

---

## System Folders (11 + Archive)

Seeded per company by migration 052. All folders are system-managed (`is_system = TRUE`):

| # | Folder | Slug | Icon | Colour |
|---|--------|------|------|--------|
| 1 | ID & Right to Work | `id-right-to-work` | travel_explore | #4F46E5 |
| 2 | DBS & Safeguarding | `dbs-safeguarding` | fingerprint | #7C3AED |
| 3 | Application Form & CV | `application-form-cv` | description | #0369A1 |
| 4 | References & Interview Notes | `references-interview` | rate_review | #0891B2 |
| 5 | Contracts & Agreements | `contracts-agreements` | contract | #059669 |
| 6 | Training & Certifications | `training-certs` | school | #D97706 |
| 7 | Shadowing & Spot Checks | `shadowing-spot-checks` | visibility | #65A30D |
| 8 | Supervision & Appraisal | `supervision-appraisal` | supervisor_account | #DC2626 |
| 9 | Health & Vaccination | `health-vaccination` | vaccines | #DB2777 |
| 10 | Leave & Absence | `leave-absence` | event_busy | #9333EA |
| 11 | Archive | `archive` | archive | #6B7280 |

---

## Database Tables

### `staff_document_folders`
- Per-company folder taxonomy
- `slug` + `company_id` unique index
- `is_system = TRUE` prevents accidental deletion

### `documents` (extended — see routing architecture)
- All routing, visibility, versioning metadata
- Soft-archive via `archived_at`
- Version grouping via `version_group_id`

### `staff_document_versions`
- One row per document version
- `version_group_id` links all versions of the same document
- `is_current = TRUE` on the active version only (unique partial index)
- `superseded_at` / `superseded_by` for rollback visibility

---

## Role-Based Visibility

Four visibility levels enforced at both API and UI layers:

```
worker_visible   — Worker portal can see this document
management_only  — Management/admin only (default for sensitive docs)
compliance_only  — Compliance officers only
confidential     — HR investigations, references, interview notes
```

### Worker Portal Rules

Workers access documents via `/api/worker/documents` which enforces:
- `worker_visible = TRUE`
- `archived_at IS NULL`
- No access to: references, interview notes, disciplinary files, confidential HR docs

Worker-visible document types:
- Contracts and agency contracts
- All training certificates
- Manual handling, fire safety, first aid, safeguarding certs
- NMC PIN certificates

---

## Document Repository (`lib/documents/repository.ts`)

### `getStaffDocumentRepository()`

Fetches the full folder tree for a staff member, including documents from:
- `staff_profile_id` (direct staff documents)
- `applicant_id` (linked application-stage documents)

Returns deduplicated, folder-grouped documents with expiry intelligence.

### `getWorkerVisibleDocuments()`

Returns only `worker_visible = TRUE` documents. Used by worker portal API.

### `getExpiringDocuments()`

Company-wide query for documents expiring within N days. Feeds expiry automation and operations alerts.

### `getDocumentVersionHistory()`

Returns all versions in a `version_group_id` ordered by version number.

---

## Versioning System

When a document is replaced:
1. `createDocumentVersion()` is called with the old + new document IDs
2. Old document: `reviewed_status = 'superseded'`, `review_status = 'archived'`
3. `staff_document_versions` row for old doc: `is_current = FALSE`, `superseded_at` set
4. New document: inherits `version_group_id`, new version row with `is_current = TRUE`
5. Audit log: `version_replaced` event

---

## Staff Profile Documents Tab

`/admin/staff/[id]?tab=documents`

### Features
- **Summary strip**: total docs / expired / expiring soon / pending review
- **Search**: real-time filename/type search across all folders
- **Filters**: All / Expiring / Expired / Compliance-linked / Pending review
- **Collapsible folder tree**: each folder shows count + expiry indicators
- **Per-folder upload zone**: document type selector + drag/drop
- **Per-document actions**: View, Download, Archive
- **Source badges**: "Uploaded during application", "Admin upload", etc.
- **Visibility badges**: worker_visible / management_only / compliance_only / confidential
- **Unclassified queue**: documents that failed auto-routing, with link to routing review

---

## Archive System

Documents are soft-archived:
- `archived_at` timestamp is set
- `folder_id` moves to the Archive folder
- `review_status = 'archived'`
- All queries include `archived_at IS NULL` by default
- Archived docs can be restored by clearing `archived_at`

Use cases:
- Terminated staff: bulk archive all documents
- Expired documents: auto-archive after grace period
- Superseded versions: auto-archive on replacement

---

## Expiry Automation

`getExpiringDocuments()` returns documents expiring within a configurable window (default: 30 days).

Expiry types tracked:
- DBS certificates
- Passports and BRP/Visa
- Right-to-work documents
- Training certificates (all types)
- NMC PIN
- Vaccination and occupational health records

UI indicators on folder headers:
- 🔴 Red badge: `N expired`
- 🟡 Yellow badge: `N expiring`

---

## Audit Trail

`document_audit_log` records every document lifecycle event:

| Event | Trigger |
|-------|---------|
| `uploaded` | Document created |
| `routed` | Folder assigned (auto or manual) |
| `manually_classified` | Admin overrides routing |
| `visibility_changed` | Visibility mode updated |
| `conversion_linked` | Applicant→staff conversion |
| `expiry_updated` | Expiry date changed |
| `compliance_linked` | Linked to compliance engine |
| `viewed` | Document viewed |
| `downloaded` | Document downloaded |
| `approved` | Admin approves document |
| `rejected` | Admin rejects document |
| `archived` | Document archived |
| `unarchived` | Document restored from archive |
| `version_replaced` | New version supersedes old |
| `deleted` | Permanent deletion |

Each event records: `actor_id`, `actor_type` (admin/staff/worker/system), `actor_label`, `previous_value`, `new_value`.

---

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/documents/routing-review` | GET | Routing diagnostics + pending queue |
| `/api/admin/documents/classify` | POST | Manually classify a document |
| `/api/admin/documents/route-document` | POST | Auto-route single doc or batch |
| `/api/admin/documents/archive` | POST | Archive a document |
| `/api/admin/staff/[id]/documents/upload` | POST | Admin uploads document |
| `/api/worker/documents` | GET | Worker-visible documents only |
| `/api/worker/documents/upload` | POST | Worker uploads document |
