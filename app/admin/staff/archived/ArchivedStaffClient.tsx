'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export interface ArchivedStaffMember {
  id:           string
  first_name:   string | null
  last_name:    string | null
  email:        string | null
  job_role:     string | null
  left_at:      string | null
  exit_reason:  string | null
  exit_notes:   string | null
  terminated_at: string | null
}

type RestoreStatus = 'pre_employment' | 'active' | 'suspended' | 'inactive'

const RESTORE_OPTIONS: { value: RestoreStatus; label: string; description: string }[] = [
  {
    value:       'pre_employment',
    label:       'Pre-employment',
    description: 'Recommended — staff must complete onboarding again before going active.',
  },
  {
    value:       'active',
    label:       'Active',
    description: 'Restore directly to active. Requires full compliance — will be blocked if not met.',
  },
  {
    value:       'suspended',
    label:       'Suspended',
    description: 'Restore in a suspended state while reviewing re-hire eligibility.',
  },
  {
    value:       'inactive',
    label:       'Inactive',
    description: 'Restore as inactive, e.g. returning from extended leave.',
  },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Restore modal ─────────────────────────────────────────────────────────────

function RestoreModal({
  staffName,
  onConfirm,
  onCancel,
  isLoading,
  error,
}: {
  staffName: string
  onConfirm: (status: RestoreStatus) => void
  onCancel:  () => void
  isLoading: boolean
  error:     string | null
}) {
  const [targetStatus, setTargetStatus] = useState<RestoreStatus>('pre_employment')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600 text-[22px]">person_check</span>
          <h3 className="text-base font-semibold text-primary">Restore Staff Member</h3>
        </div>
        <p className="text-sm text-gray-600">
          Reinstate <span className="font-semibold">{staffName}</span>. Choose which status to restore them to:
        </p>

        <div className="space-y-2">
          {RESTORE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                targetStatus === opt.value
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="restore_status"
                value={opt.value}
                checked={targetStatus === opt.value}
                onChange={() => setTargetStatus(opt.value)}
                className="mt-0.5 accent-green-600"
              />
              <div>
                <p className="text-sm font-medium text-primary">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(targetStatus)}
            disabled={isLoading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? 'Restoring…' : `Restore to ${RESTORE_OPTIONS.find(o => o.value === targetStatus)?.label}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Permanent delete modal ────────────────────────────────────────────────────

function PermanentDeleteModal({
  staffName,
  onConfirm,
  onCancel,
  isLoading,
  error,
}: {
  staffName: string
  onConfirm: () => void
  onCancel:  () => void
  isLoading: boolean
  error:     string | null
}) {
  const [confirmText, setConfirmText] = useState('')
  const canConfirm = confirmText === 'DELETE'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600 text-[24px]">warning</span>
          <h3 className="text-base font-semibold text-primary">Permanently Delete Staff Record</h3>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          This will permanently and irreversibly delete all data for{' '}
          <span className="font-semibold text-primary">{staffName}</span> including their profile,
          compliance records, and documents.
        </p>

        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 space-y-1">
          <p className="font-semibold">This action cannot be undone.</p>
          <p>Audit logs of this deletion will be retained.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Type <span className="font-mono font-bold">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || !canConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? 'Deleting…' : 'Permanently Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row actions ───────────────────────────────────────────────────────────────

function StaffRow({ member, canDelete }: { member: ArchivedStaffMember; canDelete: boolean }) {
  const router = useRouter()
  const [restoreOpen,  setRestoreOpen]  = useState(false)
  const [deleteOpen,   setDeleteOpen]   = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const displayName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email || 'Unknown'

  async function handleRestore(targetStatus: RestoreStatus) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${member.id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: targetStatus, force: false }),
      })
      const json = await res.json() as { error?: string; compliance?: { missingDocuments?: string[] } }
      if (!res.ok) {
        setError(json.error ?? 'Failed to restore staff member.')
        return
      }
      setRestoreOpen(false)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${member.id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Failed to delete staff member.')
        return
      }
      setDeleteOpen(false)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-primary">{displayName}</div>
          <div className="text-xs text-on-surface-variant">{member.email}</div>
        </td>
        <td className="px-4 py-3 text-sm text-on-surface-variant">{member.job_role || '—'}</td>
        <td className="px-4 py-3 text-sm text-on-surface-variant">{formatDate(member.left_at)}</td>
        <td className="px-4 py-3 text-sm text-on-surface-variant max-w-[200px]">
          <span className="truncate block" title={member.exit_reason ?? undefined}>
            {member.exit_reason || '—'}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(member.terminated_at)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <Link
              href={`/admin/staff/${member.id}`}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              View
            </Link>
            <button
              type="button"
              onClick={() => { setError(null); setRestoreOpen(true) }}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20 hover:bg-green-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">person_check</span>
              Restore
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => { setError(null); setDeleteOpen(true) }}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20 hover:bg-red-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                Delete
              </button>
            )}
          </div>
        </td>
      </tr>

      {restoreOpen && (
        <RestoreModal
          staffName={displayName}
          onConfirm={(status) => void handleRestore(status)}
          onCancel={() => setRestoreOpen(false)}
          isLoading={loading}
          error={error}
        />
      )}
      {deleteOpen && (
        <PermanentDeleteModal
          staffName={displayName}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteOpen(false)}
          isLoading={loading}
          error={error}
        />
      )}
    </>
  )
}

// ── Main client component ─────────────────────────────────────────────────────

export default function ArchivedStaffClient({
  staff,
  canDelete,
}: {
  staff:     ArchivedStaffMember[]
  canDelete: boolean
}) {
  if (staff.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-12 text-center">
        <span className="material-symbols-outlined text-[40px] text-on-surface-variant mb-3 block">archive</span>
        <p className="text-sm text-on-surface-variant">No archived staff members.</p>
        <p className="text-xs text-on-surface-variant mt-1">
          Staff members set to Terminated will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Role</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Termination Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Reason</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Archived On</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map((member) => (
              <StaffRow key={member.id} member={member} canDelete={canDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
