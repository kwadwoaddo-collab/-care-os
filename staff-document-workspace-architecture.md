# Staff Document Workspace Architecture

## Overview

The enterprise document workspace provides a three-panel layout (folder tree / document list / preview) for coordinators, compliance teams, and managers to review, verify, and govern workforce documents without navigating away from a staff member's profile.

---

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Staff profile tabs: Profile | Documents | Recruitment File  │
└─────────────────────────────────────────────────────────────┘
┌──────────────┬───────────────────────────┬──────────────────┐
│ Folder Tree  │  Toolbar + Bulk Bar       │                  │
│ (240px)      │  ─────────────────────── │  Preview Drawer  │
│              │  Document Table / Grid    │  (384px)         │
│  All docs    │                           │  - Preview       │
│  ─────────── │  [checkbox] File · Status │  - Metadata      │
│  ID & RTW    │  [checkbox] File · Status │  - Audit History │
│  DBS         │  [checkbox] File · Status │                  │
│  Training    │                           │  Quick actions:  │
│  ...         │                           │  Verify/Approve  │
│  ─────────── │                           │  Reject/Archive  │
│  Unclassified│                           │                  │
│  Archive     │                           │                  │
│  ─────────── │                           │                  │
│  Quick links │                           │                  │
└──────────────┴───────────────────────────┴──────────────────┘
```

---

## Component Tree

```
DocumentWorkspace           ← main orchestrator (client, stateful)
├── FolderTree              ← left sidebar (folder nav + counts)
├── BulkBar                 ← bulk actions (appears when ≥1 selected)
├── WorkspaceToolbar        ← view mode, search, filters, upload
├── DocumentTable           ← table view with checkboxes + row actions
├── PreviewDrawer           ← right panel with 3 tabs
│   ├── DocumentPreview     ← iframe (PDF) / img (image) / fallback
│   ├── MetadataPanel       ← document metadata + verification info
│   └── AuditTimeline       ← chronological audit events
└── VerificationDrawer      ← slide-in for verify/approve/reject/resubmit
```

---

## Folder Tree (`FolderTree.tsx`)

- Renders all 11 system folders with counts
- Per-folder badges: total (gray), pending verification (amber), expired (red)
- "All documents" entry at top (shows company-wide counts)
- "Unclassified" entry when docs have no folder assignment
- Archive folder shown only if it has documents
- Quick links: Verification Queue, Routing Review
- Active folder highlighted with indigo background
- Keyboard-accessible (`aria-pressed`, `aria-label`)

---

## Document Table (`DocumentTable.tsx`)

- Responsive: columns hidden on smaller screens (source→sm, expiry→md, size→lg)
- Row checkboxes for bulk selection (shift-click supported)
- Click row → opens PreviewDrawer (except on interactive elements via `data-no-row-click`)
- Inline quick actions (Approve / Reject) on each row
- Semantic `<table>` with `aria-label`, `aria-selected`, sticky header
- Amber row highlight for documents needing attention (expired/pending/rejected)

---

## Preview Drawer (`PreviewDrawer.tsx`)

Three tabs:

### Preview tab
- PDF: `<iframe>` with 5-minute signed URL
- Image: `<img>` with signed URL
- Other: download link fallback
- Signed URLs fetched from `GET /api/admin/documents/[id]/preview-url`

### Metadata (Info) tab
- Document type, file name, size, MIME type
- Upload date, source stage
- Expiry / issue date (colour-coded)
- Verified by / at / method / original_seen
- Approved by / at
- Rejection reason (highlighted in red)

### History tab
- Loads from `GET /api/admin/documents/[id]/audit-history`
- Timeline with event icons, actor labels, timestamps
- Positive events (approved, uploaded) → green dot
- Negative events (rejected, deleted) → red dot
- System events → gray dot

---

## Bulk Operations

`POST /api/admin/documents/bulk`

| Action | Effect |
|--------|--------|
| `approve` | Calls `approveDocument()` for each, sends worker notifications |
| `archive` | Soft-archives all selected docs, removes from view |
| `set_visibility` | Updates visibility enum for all selected |
| `set_worker_visible` | Toggles worker_visible boolean |
| `route` | Runs auto-routing on all selected |

Optimistic updates: UI updates immediately, rollback on error (fire-and-forget pattern with local state).

---

## Workspace Filters

| Filter | Values |
|--------|--------|
| Status | all / pending_verification / verified / approved / rejected / expiring / expired / compliance_linked / worker_visible / resubmission |
| Source stage | all / applicant / onboarding / admin_upload / worker_upload / compliance_review |
| Search | filename or document_type substring |

Filters operate client-side on already-loaded document data — no round-trip needed.

---

## API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/documents/[id]/preview-url` | GET | 5-min signed URL for inline preview |
| `/api/admin/documents/[id]/audit-history` | GET | Document audit trail (50 events) |
| `/api/admin/documents/bulk` | POST | Bulk approve/archive/visibility/route |

---

## Worker Document Center (`/worker/documents`)

Improvements in Phase 3:

### Status summary strip (4 cards)
- Total, Approved, Under review, Action needed

### Resubmission alerts
- Highlighted panel when `resubmission_requested = true`
- Shows rejection reason
- "Upload replacement" CTA per document

### Expiry reminders panel
- Shows expired + expiring-soon docs as a scannable list
- Colour-coded (red = expired, amber = expiring soon)

### Verification status badges
- `VerificationStatusBadge` replaces legacy `ReviewBadge`
- Shows all 6 verification states including "Resubmission required"

---

## Performance

- Server component fetches folder data at page load (via `getStaffDocumentRepository`)
- Client state initialized from server props — no client-side hydration fetch needed
- Preview URLs fetched on demand (only when preview drawer opens)
- Audit history fetched on demand (only when History tab is viewed)
- Optimistic state updates for verify/approve/reject/archive — no page reload
- Filter operations run client-side on in-memory document list

---

## Accessibility

- All interactive elements have `aria-label`
- Table uses semantic `<table>`, `<thead>`, `<tbody>`
- Checkboxes have `aria-label` per row
- Folder tree uses `<nav>` with `aria-label`
- Drawer uses `role="dialog"` / `aria-modal` / `aria-label`
- Verification status badges use meaningful text labels
- Focus indicators preserved (focus:ring-2 on all interactive elements)
- Status changes announced via `aria-live="polite"` on BulkBar

---

## Security

- All API routes require `requireAdmin()` — 401 on unauthenticated access
- Signed URL generation verifies document belongs to caller's company before issuing URL
- Bulk operations verify all document IDs against company before processing
- Worker portal enforces `worker_visible = TRUE` — no access to confidential docs
- RBAC enforced: compliance routes check `canViewCompliance`
