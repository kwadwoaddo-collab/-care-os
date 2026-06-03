'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = 'not_started' | 'in_progress' | 'complete' | 'rejected'
type CheckType = 'dbs' | 'right_to_work' | 'reference' | 'id_verification'

interface PreEmploymentCheck {
  id: string
  staff_profile_id: string
  check_type: CheckType
  status: CheckStatus
  // DBS
  dbs_type: string | null
  dbs_certificate_number: string | null
  dbs_issue_date: string | null
  dbs_expiry_date: string | null
  // RTW
  rtw_document_type: string | null
  rtw_checked_date: string | null
  rtw_expiry_date: string | null
  rtw_checked_by: string | null
  // Reference
  ref_referee_name: string | null
  ref_referee_role: string | null
  ref_referee_email: string | null
  ref_requested_date: string | null
  ref_received_date: string | null
  ref_employer_name: string | null
  // General
  notes: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

interface Props {
  staffProfileId: string
  checks: PreEmploymentCheck[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CheckStatus, { label: string; badgeCls: string; dotCls: string }> = {
  not_started: {
    label: 'Not Started',
    badgeCls: 'bg-gray-100 text-gray-700 ring-gray-400/30',
    dotCls: 'bg-gray-400',
  },
  in_progress: {
    label: 'In Progress',
    badgeCls: 'bg-yellow-50 text-yellow-700 ring-yellow-500/30',
    dotCls: 'bg-yellow-500',
  },
  complete: {
    label: 'Complete',
    badgeCls: 'bg-green-50 text-green-700 ring-green-500/30',
    dotCls: 'bg-green-500',
  },
  rejected: {
    label: 'Rejected',
    badgeCls: 'bg-red-50 text-red-700 ring-red-500/30',
    dotCls: 'bg-red-500',
  },
}

function fmt(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${cfg.badgeCls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
      {cfg.label}
    </span>
  )
}

// ── DBS Check Card ────────────────────────────────────────────────────────────

function DbsCard({ check, staffProfileId }: { check: PreEmploymentCheck | null; staffProfileId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const status: CheckStatus = check?.status ?? 'not_started'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const fd = new FormData(e.currentTarget)
    const payload = {
      check_type: 'dbs',
      status: fd.get('status'),
      dbs_type: fd.get('dbs_type') || null,
      dbs_certificate_number: fd.get('dbs_certificate_number') || null,
      dbs_issue_date: fd.get('dbs_issue_date') || null,
      dbs_expiry_date: fd.get('dbs_expiry_date') || null,
      notes: fd.get('notes') || null,
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/pre-employment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
        setSuccess(true)
        setOpen(false)
        router.refresh()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-on-primary">fingerprint</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">DBS Check</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Disclosure &amp; Barring Service</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Summary details */}
        {check && status !== 'not_started' && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Type</p>
              <p className="text-sm text-on-surface capitalize">{check.dbs_type?.replace(/_/g, ' ') ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Certificate No.</p>
              <p className="text-sm text-on-surface font-mono">{check.dbs_certificate_number ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Issue Date</p>
              <p className="text-sm text-on-surface">{fmt(check.dbs_issue_date)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Expiry Date</p>
              <p className={`text-sm font-semibold ${
                check.dbs_expiry_date && new Date(check.dbs_expiry_date) < new Date()
                  ? 'text-red-600'
                  : 'text-on-surface'
              }`}>{fmt(check.dbs_expiry_date)}</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'edit'}</span>
          {open ? 'Cancel' : 'Update Check'}
        </button>
      </div>

      {open && (
        <div className="border-t border-outline-variant p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Status *</label>
                <select name="status" defaultValue={check?.status ?? 'not_started'} className="input">
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">DBS Type</label>
                <select name="dbs_type" defaultValue={check?.dbs_type ?? ''} className="input">
                  <option value="">— Select type —</option>
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="enhanced">Enhanced</option>
                  <option value="enhanced_barred">Enhanced with Barred List</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Certificate Number</label>
                <input name="dbs_certificate_number" type="text" defaultValue={check?.dbs_certificate_number ?? ''} placeholder="e.g. 001234567890" className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Issue Date</label>
                <input name="dbs_issue_date" type="date" defaultValue={check?.dbs_issue_date ?? ''} className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Expiry Date</label>
                <input name="dbs_expiry_date" type="date" defaultValue={check?.dbs_expiry_date ?? ''} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Notes</label>
              <textarea name="notes" rows={2} defaultValue={check?.notes ?? ''} placeholder="Any additional notes..." className="input resize-none" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-green-600">Saved successfully.</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {pending ? 'Saving…' : 'Save DBS Check'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ── Right to Work Card ────────────────────────────────────────────────────────

function RtwCard({ check, staffProfileId }: { check: PreEmploymentCheck | null; staffProfileId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const status: CheckStatus = check?.status ?? 'not_started'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      check_type: 'right_to_work',
      status: fd.get('status'),
      rtw_document_type: fd.get('rtw_document_type') || null,
      rtw_checked_date: fd.get('rtw_checked_date') || null,
      rtw_expiry_date: fd.get('rtw_expiry_date') || null,
      rtw_checked_by: fd.get('rtw_checked_by') || null,
      notes: fd.get('notes') || null,
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/pre-employment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
        setOpen(false)
        router.refresh()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-on-secondary-container">badge</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">Right to Work</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">UK eligibility verification</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {check && status !== 'not_started' && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Document Type</p>
              <p className="text-sm text-on-surface">{check.rtw_document_type ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Checked Date</p>
              <p className="text-sm text-on-surface">{fmt(check.rtw_checked_date)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Expiry</p>
              <p className={`text-sm font-semibold ${
                check.rtw_expiry_date && new Date(check.rtw_expiry_date) < new Date()
                  ? 'text-red-600'
                  : 'text-on-surface'
              }`}>{fmt(check.rtw_expiry_date)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Checked By</p>
              <p className="text-sm text-on-surface">{check.rtw_checked_by ?? '—'}</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'edit'}</span>
          {open ? 'Cancel' : 'Update Check'}
        </button>
      </div>

      {open && (
        <div className="border-t border-outline-variant p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Status *</label>
                <select name="status" defaultValue={check?.status ?? 'not_started'} className="input">
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Document Type</label>
                <select name="rtw_document_type" defaultValue={check?.rtw_document_type ?? ''} className="input">
                  <option value="">— Select document —</option>
                  <option value="UK Passport">UK Passport</option>
                  <option value="EEA Passport">EEA Passport</option>
                  <option value="Biometric Residence Permit">Biometric Residence Permit</option>
                  <option value="Certificate of Naturalisation">Certificate of Naturalisation</option>
                  <option value="Share Code (Online Check)">Share Code (Online Check)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Date Checked</label>
                <input name="rtw_checked_date" type="date" defaultValue={check?.rtw_checked_date ?? ''} className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Document Expiry Date</label>
                <input name="rtw_expiry_date" type="date" defaultValue={check?.rtw_expiry_date ?? ''} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Checked By</label>
                <input name="rtw_checked_by" type="text" defaultValue={check?.rtw_checked_by ?? ''} placeholder="Name of person who verified" className="input" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Notes</label>
              <textarea name="notes" rows={2} defaultValue={check?.notes ?? ''} placeholder="Any additional notes..." className="input resize-none" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {pending ? 'Saving…' : 'Save RTW Check'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ── Reference Card ────────────────────────────────────────────────────────────

function ReferenceCard({ check, staffProfileId }: { check: PreEmploymentCheck | null; staffProfileId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const status: CheckStatus = check?.status ?? 'not_started'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      check_type: 'reference',
      status: fd.get('status'),
      ref_referee_name: fd.get('ref_referee_name') || null,
      ref_referee_role: fd.get('ref_referee_role') || null,
      ref_referee_email: fd.get('ref_referee_email') || null,
      ref_employer_name: fd.get('ref_employer_name') || null,
      ref_requested_date: fd.get('ref_requested_date') || null,
      ref_received_date: fd.get('ref_received_date') || null,
      notes: fd.get('notes') || null,
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/pre-employment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
        setOpen(false)
        router.refresh()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-green-700">rate_review</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">References</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Employment reference verification</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {check && status !== 'not_started' && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Referee</p>
              <p className="text-sm text-on-surface">{check.ref_referee_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Employer</p>
              <p className="text-sm text-on-surface">{check.ref_employer_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Requested</p>
              <p className="text-sm text-on-surface">{fmt(check.ref_requested_date)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Received</p>
              <p className="text-sm font-semibold text-on-surface">{fmt(check.ref_received_date)}</p>
            </div>
            {check.ref_referee_email && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Email</p>
                <p className="text-sm text-on-surface break-all">{check.ref_referee_email}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'edit'}</span>
          {open ? 'Cancel' : 'Update Check'}
        </button>
      </div>

      {open && (
        <div className="border-t border-outline-variant p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Status *</label>
                <select name="status" defaultValue={check?.status ?? 'not_started'} className="input">
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Employer Name</label>
                <input name="ref_employer_name" type="text" defaultValue={check?.ref_employer_name ?? ''} placeholder="e.g. NHS Trust" className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Referee Full Name</label>
                <input name="ref_referee_name" type="text" defaultValue={check?.ref_referee_name ?? ''} className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Referee Role / Title</label>
                <input name="ref_referee_role" type="text" defaultValue={check?.ref_referee_role ?? ''} placeholder="e.g. HR Manager" className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Referee Email</label>
                <input name="ref_referee_email" type="email" defaultValue={check?.ref_referee_email ?? ''} className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Date Requested</label>
                <input name="ref_requested_date" type="date" defaultValue={check?.ref_requested_date ?? ''} className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Date Received</label>
                <input name="ref_received_date" type="date" defaultValue={check?.ref_received_date ?? ''} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Notes</label>
              <textarea name="notes" rows={2} defaultValue={check?.notes ?? ''} placeholder="Any additional notes..." className="input resize-none" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {pending ? 'Saving…' : 'Save Reference'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ── ID Verification Card ──────────────────────────────────────────────────────

function IdVerificationCard({ check, staffProfileId }: { check: PreEmploymentCheck | null; staffProfileId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const status: CheckStatus = check?.status ?? 'not_started'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      check_type: 'id_verification',
      status: fd.get('status'),
      notes: fd.get('notes') || null,
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/pre-employment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
        setOpen(false)
        router.refresh()
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-yellow-700">contact_page</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">ID Verification</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Identity document check</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {check?.notes && status !== 'not_started' && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Notes</p>
            <p className="text-sm text-on-surface mt-0.5">{check.notes}</p>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'edit'}</span>
          {open ? 'Cancel' : 'Update Check'}
        </button>
      </div>

      {open && (
        <div className="border-t border-outline-variant p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Status *</label>
              <select name="status" defaultValue={check?.status ?? 'not_started'} className="input">
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Notes</label>
              <textarea name="notes" rows={3} defaultValue={check?.notes ?? ''} placeholder="Describe which ID documents were verified and by whom..." className="input resize-none" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {pending ? 'Saving…' : 'Save ID Check'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ── Overall progress header ────────────────────────────────────────────────────

function OverallProgress({ checks }: { checks: PreEmploymentCheck[] }) {
  const total = 4
  const complete = checks.filter((c) => c.status === 'complete').length
  const pct = Math.round((complete / total) * 100)
  const hasRejection = checks.some((c) => c.status === 'rejected')

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-on-surface">Overall Progress</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {complete} of {total} checks complete
            {hasRejection && ' · 1 rejected'}
          </p>
        </div>
        <p className={`text-2xl font-extrabold tabular-nums ${
          pct === 100 ? 'text-green-600' : hasRejection ? 'text-red-600' : pct > 0 ? 'text-yellow-600' : 'text-on-surface-variant'
        }`}>{pct}%</p>
      </div>
      <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct === 100 ? 'bg-green-500' : hasRejection ? 'bg-red-500' : 'bg-yellow-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Main exported component ───────────────────────────────────────────────────

export default function PreEmploymentChecksClient({ staffProfileId, checks }: Props) {
  const byType = (type: CheckType) => checks.find((c) => c.check_type === type) ?? null

  return (
    <div className="space-y-4">
      <OverallProgress checks={checks} />

      <div className="grid grid-cols-1 gap-4">
        <DbsCard check={byType('dbs')} staffProfileId={staffProfileId} />
        <RtwCard check={byType('right_to_work')} staffProfileId={staffProfileId} />
        <ReferenceCard check={byType('reference')} staffProfileId={staffProfileId} />
        <IdVerificationCard check={byType('id_verification')} staffProfileId={staffProfileId} />
      </div>
    </div>
  )
}
