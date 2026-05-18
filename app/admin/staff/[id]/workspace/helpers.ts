import type { WorkspaceDocument, FilterKey, WorkspaceFilters } from './types'

export const SOURCE_LABELS: Record<string, string> = {
  applicant:         'Application stage',
  onboarding:        'Onboarding',
  staff:             'Staff upload',
  admin_upload:      'Admin upload',
  worker_upload:     'Worker portal',
  compliance_review: 'Compliance review',
  operations_upload: 'Operations',
}

export const VERIFICATION_STATUS_MAP: Record<string, { label: string; cls: string; icon: string }> = {
  pending_verification: { label: 'Pending',    cls: 'bg-amber-100 text-amber-800 ring-amber-600/20',   icon: 'hourglass_empty' },
  verified:             { label: 'Verified',   cls: 'bg-blue-100 text-blue-800 ring-blue-600/20',      icon: 'verified_user'   },
  approved:             { label: 'Approved',   cls: 'bg-green-100 text-green-800 ring-green-600/20',   icon: 'check_circle'    },
  rejected:             { label: 'Rejected',   cls: 'bg-red-100 text-red-800 ring-red-600/20',         icon: 'cancel'          },
  expired:              { label: 'Expired',    cls: 'bg-gray-100 text-gray-600 ring-gray-400/20',      icon: 'event_busy'      },
  superseded:           { label: 'Superseded', cls: 'bg-gray-100 text-gray-400 ring-gray-300/20',      icon: 'history'         },
}

export function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function isExpired(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date()
}

export function isExpiringSoon(iso: string | null, days = 30): boolean {
  if (!iso) return false
  const e = new Date(iso); const w = new Date(); w.setDate(w.getDate() + days)
  return e > new Date() && e <= w
}

export function docTypeLabel(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function applyFilters(
  docs: WorkspaceDocument[],
  filters: WorkspaceFilters,
): WorkspaceDocument[] {
  return docs.filter((d) => {
    // Status filter
    const vs = d.verification_status ?? ''
    if (filters.status === 'pending_verification' && vs !== 'pending_verification') return false
    if (filters.status === 'verified'             && vs !== 'verified')             return false
    if (filters.status === 'approved'             && vs !== 'approved')             return false
    if (filters.status === 'rejected'             && vs !== 'rejected')             return false
    if (filters.status === 'expiring'             && !isExpiringSoon(d.expiry_date)) return false
    if (filters.status === 'expired'              && !isExpired(d.expiry_date))      return false
    if (filters.status === 'worker_visible'       && !d.worker_visible)             return false
    if (filters.status === 'compliance_linked'    && !d.compliance_linked)          return false
    if (filters.status === 'resubmission'         && !d.resubmission_requested)     return false
    // Source filter
    if (filters.sourceStage && d.source_stage !== filters.sourceStage) return false
    // Worker visible
    if (filters.workerVisible === true  && !d.worker_visible)  return false
    if (filters.workerVisible === false && d.worker_visible)   return false
    // Search
    if (filters.search) {
      const s = filters.search.toLowerCase()
      if (!d.file_name.toLowerCase().includes(s) && !d.document_type.toLowerCase().includes(s)) return false
    }
    return true
  })
}

export function folderDocCounts(docs: WorkspaceDocument[]): {
  total: number; pending: number; expiring: number; expired: number; rejected: number
} {
  return {
    total:    docs.length,
    pending:  docs.filter((d) => d.verification_status === 'pending_verification').length,
    expiring: docs.filter((d) => isExpiringSoon(d.expiry_date)).length,
    expired:  docs.filter((d) => isExpired(d.expiry_date)).length,
    rejected: docs.filter((d) => d.verification_status === 'rejected').length,
  }
}
