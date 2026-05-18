# Document Routing Architecture

## Overview

The Care OS document routing system provides automatic classification, folder assignment, source tracking, and applicant-to-staff document continuity.

---

## Core Concept

Every document in the system is automatically classified into one of 11 system folders based on its `document_type`. Documents that cannot be classified are flagged for manual review via the routing review screen at `/admin/documents/routing`.

---

## Database Schema

### `documents` (extended)

New columns added by migration 051:

| Column | Type | Purpose |
|--------|------|---------|
| `source_stage` | `document_source_stage` enum | Where the doc originated |
| `folder_id` | UUID → `staff_document_folders` | Folder assignment |
| `version_group_id` | UUID | Groups document versions |
| `visibility` | `document_visibility` enum | Access control mode |
| `worker_visible` | boolean | Whether worker can see this |
| `compliance_linked` | boolean | Linked to compliance engine |
| `archived_at` | timestamptz | Soft-archive timestamp |
| `requires_manual_review` | boolean | Flag for routing queue |
| `original_filename` | text | Preserved original filename |
| `review_status` | text | Routing state |

### `staff_document_folders`

System-defined folder taxonomy. Seeded per company by migration 052.

| ID | Folder Name | Slug |
|----|-------------|------|
| 1 | ID & Right to Work | `id-right-to-work` |
| 2 | DBS & Safeguarding | `dbs-safeguarding` |
| 3 | Application Form & CV | `application-form-cv` |
| 4 | References & Interview Notes | `references-interview` |
| 5 | Contracts & Agreements | `contracts-agreements` |
| 6 | Training & Certifications | `training-certs` |
| 7 | Shadowing & Spot Checks | `shadowing-spot-checks` |
| 8 | Supervision & Appraisal | `supervision-appraisal` |
| 9 | Health & Vaccination | `health-vaccination` |
| 10 | Leave & Absence | `leave-absence` |
| 11 | Archive | `archive` |

### `document_routing_log`

Immutable log of every routing decision (auto or manual).

### `document_audit_log`

Full lifecycle audit trail covering: uploaded, routed, classified, viewed, downloaded, approved, rejected, archived, version_replaced, deleted.

---

## Source Stage Enum

```
applicant          — Uploaded during application flow
onboarding         — Uploaded during onboarding
staff              — Staff-initiated upload (generic)
admin_upload       — Admin uploaded via staff profile
worker_upload      — Worker portal upload
compliance_review  — Uploaded during compliance review
operations_upload  — Uploaded by operations team
```

---

## Folder Routing Rules (`lib/documents/routing.ts`)

The `resolveDocumentFolder(documentType)` function maps `document_type` → `FolderSlug` via a static routing table. Unmapped types return `null` and are flagged with `review_status = 'unrecognised'`.

### Routing Table Summary

| Document Type | → Folder |
|---------------|----------|
| passport, brp, visa, right_to_work, share_code | ID & Right to Work |
| dbs, dbs_certificate, safeguarding_* | DBS & Safeguarding |
| cv, application_form, covering_letter | Application Form & CV |
| reference, interview_notes | References & Interview Notes |
| contract, policy_acknowledgement | Contracts & Agreements |
| training_certificate, manual_handling, fire_safety, first_aid, nmc_pin | Training & Certifications |
| spot_check, competency_assessment | Shadowing & Spot Checks |
| supervision, appraisal | Supervision & Appraisal |
| vaccination, occupational_health | Health & Vaccination |
| fit_note, return_to_work | Leave & Absence |

---

## Visibility Governance

```
worker_visible  — Worker portal access permitted
management_only — Admin/management only (default)
compliance_only — Compliance officers only
confidential    — Highest restriction (references, disciplinaries)
```

Worker portal (`/api/worker/documents`) enforces `worker_visible = TRUE` at query level. Workers can never see:
- References and interview notes (`confidential`)
- Internal HR investigations
- Disciplinary files

---

## Applicant → Staff Conversion Continuity

Triggered by `linkApplicantDocumentsToStaff()` (called from `/api/admin/applicants/[id]/convert`):

1. All documents with `applicant_id` are linked to `staff_profile_id`
2. `source_stage` is preserved (stays `applicant` or `onboarding`)
3. `applicant_id` is never cleared — audit trail is preserved
4. Each document is auto-routed into its folder
5. A `conversion_linked` event is written to `document_audit_log`

The UI shows documents labelled "Uploaded during application" or "Uploaded during onboarding" based on `source_stage`.

---

## Auto-routing Triggers

Auto-routing happens at:
1. Admin upload (`/api/admin/staff/[id]/documents/upload`) — routes immediately after insert
2. Applicant conversion (`/api/admin/applicants/[id]/convert`) — routes all applicant docs
3. Batch re-route (`POST /api/admin/documents/route-document { mode: 'batch' }`) — routes all unrouted docs for a company

---

## Routing Review Screen

`/admin/documents/routing` — admin-only panel showing:

- **Diagnostics strip**: total / auto-routed / pending review / unrecognised / manually classified / compliance linked
- **Batch routing button**: run auto-routing across all unrouted documents
- **Review table**: all documents with source, current folder, status, and manual classification control
- **Unrecognised alert**: highlighted list of documents needing manual classification

### Manual Classification

`POST /api/admin/documents/classify`
```json
{ "documentId": "...", "folderSlug": "training-certs", "notes": "optional" }
```
Sets `review_status = 'manually_classified'`, updates `folder_id`, logs in both `document_routing_log` and `document_audit_log`.

---

## Compliance Integration

Documents with `compliance_linked = TRUE` are linked to the compliance engine, expiry automation, and risk scoring. These types are automatically flagged:
- DBS certificates
- Passports, BRPs, visas, right-to-work checks
- All training certificates
- NMC PIN
- Vaccination and occupational health records
