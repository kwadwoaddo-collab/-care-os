# Application Form PDF Generation & Custom Document Folders
## Architecture Document — Care OS

---

## Overview

This document describes the implementation of two related features:

1. **Automatic PDF generation** of completed applicant application forms
2. **Custom document folder management** in the staff document repository

Both features are additive to the existing document system (migrations 051–055) and share the same storage bucket, folder taxonomy, and audit trail infrastructure.

---

## 1. Application Form PDF Generation

### Flow

```
Applicant submits form
  → POST /api/applicant/apply (submit: true)
    → form_response.status = 'submitted'
    → generateAndStoreApplicationPdf() [async, non-blocking]
      → load applicant record + form response + answers
      → map answers to PDF sections
      → generate PDF bytes (pdf-lib)
      → upload to care-os-documents bucket
      → insert documents row
      → route to 'application-form-cv' folder
      → write document_audit_log + audit_logs
```

### PDF Generator (`lib/documents/pdf-generator.ts`)

- Library: **pdf-lib** (pure JS, no binary deps, works in all Next.js environments)
- Output: A4 portrait PDF with branded header, applicant summary box, and structured sections
- Font: Helvetica Bold / Regular (built-in PDF standard fonts — no external font loading)
- Layout: Manual coordinate tracking with automatic page-break detection
- Text: Wraps long values respecting content width
- JSONB flattening: Arrays (employment history, references) are formatted as numbered lists; objects are formatted as key:value pairs

### Storage Path

```
{company_id}/applicants/{applicant_id}/application_form/{fileName}
```

`fileName` format: `application-form-{safeName}-{timestamp}.pdf`

### Document Record Fields

| Field | Value |
|-------|-------|
| document_type | `application_form` |
| source_stage | `applicant` |
| source_label | `Generated from application submission` |
| folder_id | Resolved to `application-form-cv` system folder |
| visibility | `management_only` |
| worker_visible | `false` |
| compliance_linked | `false` |
| verification_status | `approved` |
| review_status | `auto_routed` |

### PDF Sections

| Section | Form fields included |
|---------|---------------------|
| Personal Details | name, email, phone, DOB, NI, address |
| Employment & Education History | employment_history, gap_declarations |
| References | references (formatted list) |
| Right to Work | uk_eligible, right_to_work_type, visa, share_code |
| Criminal Record & DBS | criminal_record declaration |
| Care Experience | previous_experience, details, preferred_setting |
| Training & Qualifications | qualifications, professional_registration |
| Other Details | office_experience, application_source, availability |
| Emergency Contact | name, relationship, phone, email |
| Declaration & Consent | declaration_consent, application_declarations |

### Applicant → Staff Conversion

When `POST /api/admin/applicants/[id]/convert` is called:

1. `linkApplicantDocumentsToStaff()` links all applicant documents to the new `staff_profile_id`
2. `linkApplicationPdfToStaff()` specifically ensures the auto-generated PDF is linked
3. The PDF remains in `application-form-cv` folder — no re-routing needed
4. `source_label` remains `"Generated from application submission"` as a provenance indicator

### Admin Manual Upload

Admins can upload existing application form PDFs via the document workspace:

- Select document type: **Application Form**
- Upload routes automatically to `application-form-cv` folder
- `source_stage` = `admin_upload`
- `source_label` is not set (distinguishes from auto-generated PDFs)

---

## 2. Custom Document Folders

### Database

Migration `056_custom_document_folders.sql` adds three columns to `staff_document_folders`:

| Column | Type | Purpose |
|--------|------|---------|
| `archived_at` | `TIMESTAMPTZ` | Soft-delete custom folders |
| `created_by` | `UUID → profiles.id` | Audit trail — who created the folder |
| `is_custom` | `BOOLEAN DEFAULT false` | Distinguishes custom vs system rows |

**Existing `is_system` column** already distinguishes system (seeded by migrations) from custom (created at runtime). `is_custom = !is_system` for all rows.

### System Folders (Protected)

These 11 folders are seeded per company and cannot be renamed, reordered, or archived:

```
id-right-to-work · dbs-safeguarding · application-form-cv
references-interview · contracts-agreements · training-certs
shadowing-spot-checks · supervision-appraisal · health-vaccination
leave-absence · archive
```

Protection is enforced at the API layer, not via database constraints.

### API Endpoints

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/admin/documents/folders` | List all company folders (excluding archived) |
| POST | `/api/admin/documents/folders` | Create custom folder |
| PATCH | `/api/admin/documents/folders/[id]` | Rename / reorder custom folder |
| DELETE | `/api/admin/documents/folders/[id]` | Archive custom folder |

**Create validation:**
- Name 2–80 chars
- Slug auto-derived: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')`
- Slug must not match any system folder slug
- Name must be unique per company

**Archive behaviour:**
- Sets `archived_at` on the folder row
- Moves all documents in the folder to `folder_id = null` (unclassified) by default
- Pass `?move_to_archive=true` to move documents to the Archive system folder instead
- Archived folders are hidden from `getStaffDocumentRepository()` (filtered by `is('archived_at', null)`)

### UI Components

**`FolderTree.tsx`**
- System folders: show lock icon (`lock` Material Symbol), no context menu
- Custom folders: show kebab menu on hover with Rename and Archive actions
- `+ New folder` button at bottom of folder list opens `NewFolderDialog`
- After folder CRUD: calls `window.location.reload()` (server-rendered data)

**`DocumentWorkspace.tsx`**
- `MoveDocumentDialog`: folder picker to move a document between folders
- `DeleteConfirmDialog`: permanent deletion confirmation (only shown for archived docs)
- Upload button now includes Application Form and CV as type options

**`PreviewDrawer.tsx`**
- Move button: opens MoveDocumentDialog via `onAction('move', docId)`
- Archive button: soft-archives document
- Delete button: only shown when `doc.archived_at` is set; opens DeleteConfirmDialog

---

## 3. Document Deletion

### Two-step deletion model

```
Step 1: Archive (soft)
  POST /api/admin/documents/archive
  → sets archived_at = NOW()
  → document hidden from repository view
  → can be restored

Step 2: Permanent delete (hard)
  POST /api/admin/documents/delete
  → requires confirm: true in body
  → requires document to be already archived (archived_at IS NOT NULL)
  → sets deleted_at = NOW()  (schema addition from migration 056)
  → optionally removes file from storage (deleteFromStorage: true)
  → all audit log entries remain
```

**Permission guard:** Only `registered_manager`, `company_admin`, `super_admin` roles may permanently delete. Coordinators and compliance_managers cannot.

**Audit trail:** Both archive and delete events are written to:
- `document_audit_log` (document-specific)
- `audit_logs` (company-wide)

The audit records are written **before** deletion so they can reference the document row.

---

## 4. Audit Events

| Event | Table | Trigger |
|-------|-------|---------|
| `application_pdf.generated` | `audit_logs` | PDF auto-generated on form submission |
| `uploaded` | `document_audit_log` | PDF document record created |
| `document_folder.created` | `audit_logs` | Admin creates custom folder |
| `document_folder.renamed` | `audit_logs` | Admin renames custom folder |
| `document_folder.archived` | `audit_logs` | Admin archives custom folder |
| `manually_classified` | `document_audit_log` | Document moved between folders |
| `document.moved` | `audit_logs` | Document moved between folders |
| `document.permanently_deleted` | `audit_logs` | Permanent delete |
| `deleted` | `document_audit_log` | Permanent delete |

---

## 5. Security Invariants

| Invariant | Where enforced |
|-----------|----------------|
| Tenant isolation — all queries filter by `company_id` | API routes + `requireAdmin()` |
| System folder protection — cannot modify is_system=true rows | `POST/PATCH/DELETE /api/admin/documents/folders/[id]` |
| Worker visibility — `worker_visible=false` on application PDFs | `generateAndStoreApplicationPdf()` |
| Permanent delete permission | `role` check in `/api/admin/documents/delete` |
| Archive-before-delete guard | `deleted_at` only set after `archived_at IS NOT NULL` |
| Signed URL protection | Unchanged — all file access via signed URLs (1hr expiry) |
| RBAC — admin routes require `requireAdmin()` | All document API routes |

---

## 6. Migration Summary

```
056_custom_document_folders.sql
  ALTER TABLE staff_document_folders
    ADD COLUMN archived_at   TIMESTAMPTZ
    ADD COLUMN created_by    UUID → profiles(id)
    ADD COLUMN is_custom     BOOLEAN DEFAULT false

  ALTER TABLE documents
    ADD COLUMN source_label  TEXT       -- provenance for auto-generated docs
    ADD COLUMN deleted_at    TIMESTAMPTZ -- permanent soft-delete marker

  CREATE INDEX idx_documents_not_deleted ON documents(company_id, created_at DESC)
    WHERE deleted_at IS NULL
```

---

## 7. Files Created / Modified

### New files
| File | Purpose |
|------|---------|
| `supabase/migrations/056_custom_document_folders.sql` | Schema additions |
| `lib/documents/pdf-generator.ts` | pdf-lib based A4 PDF layout engine |
| `lib/documents/application-pdf.ts` | PDF generation + storage + document record creation |
| `app/api/admin/documents/folders/route.ts` | Folder list + create |
| `app/api/admin/documents/folders/[id]/route.ts` | Folder rename + archive |
| `app/api/admin/documents/move/route.ts` | Move document between folders |
| `app/api/admin/documents/delete/route.ts` | Permanent document deletion |

### Modified files
| File | Change |
|------|--------|
| `lib/documents/constants.ts` | Added `application_form`, `cv` document types |
| `lib/documents/repository.ts` | `is_system`, `is_custom`, `source_label`, `deleted_at` in types + queries |
| `app/api/applicant/apply/route.ts` | Trigger PDF generation on form submission |
| `app/api/admin/applicants/[id]/convert/route.ts` | Link application PDF to new staff profile |
| `app/admin/staff/[id]/workspace/types.ts` | `is_system`, `is_custom`, `source_label` in types |
| `app/admin/staff/[id]/workspace/FolderTree.tsx` | New folder button, lock icons, custom folder menu |
| `app/admin/staff/[id]/workspace/DocumentWorkspace.tsx` | Move dialog, delete dialog, companyId prop to FolderTree |
| `app/admin/staff/[id]/workspace/PreviewDrawer.tsx` | Move and Delete action buttons |
| `app/admin/staff/[id]/workspace/DocumentTable.tsx` | Expanded action type union |

---

*Generated: 2026-05-19 | Care OS*
