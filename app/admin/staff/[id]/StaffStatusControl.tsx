'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const STATUSES = [
  { value: 'pre_employment', label: 'Pre-employment', cls: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 hover:bg-yellow-100' },
  { value: 'active',         label: 'Active',         cls: 'bg-green-50  text-green-700  ring-green-600/20  hover:bg-green-100' },
  { value: 'suspended',      label: 'Suspended',      cls: 'bg-orange-50 text-orange-700 ring-orange-600/20 hover:bg-orange-100' },
  { value: 'inactive',       label: 'Inactive',       cls: 'bg-gray-50   text-gray-600   ring-gray-500/20   hover:bg-gray-100' },
  { value: 'terminated',     label: 'Terminated',     cls: 'bg-red-50    text-red-700    ring-red-600/20    hover:bg-red-100' },
]

interface ComplianceIssues {
  missingDocuments?: string[]
  expiredDocuments?: string[]
  missingTraining?:  string[]
  percentage?:       number
}

interface StaffStatusControlProps {
  staffProfileId: string
  currentStatus:  string
  isCompliant:    boolean
}

interface FutureShiftWarning {
  future_shift_count: number
  next_shift_date:    string
  pendingStatus:      string
}

export default function StaffStatusControl({
  staffProfileId,
  currentStatus,
  isCompliant,
}: StaffStatusControlProps) {
  const router = useRouter()
  const [error,          setError]         = useState<string | null>(null)
  const [issues,         setIssues]        = useState<ComplianceIssues | null>(null)
  const [isPending,      startTransition]  = useTransition()
  const [localStatus,    setLocalStatus]   = useState(currentStatus)
  const [shiftWarning,   setShiftWarning]  = useState<FutureShiftWarning | null>(null)

  async function doStatusChange(newStatus: string, force = false, unassignShifts = false) {
    setError(null)
    setIssues(null)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/status`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: newStatus, force, unassign_shifts: unassignShifts }),
        })
        const json = await res.json() as {
          error?:              string
          compliance?:         ComplianceIssues
          staff_profile?:      { status: string }
          needs_confirmation?: boolean
          future_shift_count?: number
          next_shift_date?:    string
        }

        if (!res.ok) {
          setError(json.error ?? 'Failed to update status.')
          if (json.compliance) setIssues(json.compliance)
          return
        }

        if (json.needs_confirmation) {
          setShiftWarning({
            future_shift_count: json.future_shift_count ?? 0,
            next_shift_date:    json.next_shift_date ?? '',
            pendingStatus:      newStatus,
          })
          return
        }

        setLocalStatus(newStatus)
        router.refresh()
      } catch {
        setError('Network error — please try again.')
      }
    })
  }

  function handleStatusChange(newStatus: string) {
    if (newStatus === localStatus) return
    void doStatusChange(newStatus, false)
  }

  function confirmStatusChange(unassignShifts = false) {
    if (!shiftWarning) return
    const pending = shiftWarning.pendingStatus
    setShiftWarning(null)
    void doStatusChange(pending, true, unassignShifts)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Staff Status</h2>
      </div>

      <div className="p-4 space-y-3">
        {/* Compliance warning for active */}
        {!isCompliant && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <span className="font-medium">⚠ Compliance incomplete.</span>{' '}
            Staff cannot be activated until mandatory compliance is complete.
          </div>
        )}

        {/* Status buttons */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const isCurrent  = localStatus === s.value
            const isDisabled = isPending || (s.value === 'active' && !isCompliant)

            return (
              <button
                key={s.value}
                type="button"
                disabled={isDisabled}
                onClick={() => handleStatusChange(s.value)}
                title={s.value === 'active' && !isCompliant ? 'Resolve compliance issues first' : undefined}
                className={[
                  'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                  s.cls,
                  isCurrent   ? 'ring-2 shadow-sm'            : '',
                  isDisabled  ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                {isCurrent && <span className="mr-1">●</span>}
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Error / blocked message */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <p className="font-medium">{error}</p>

            {issues && (
              <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
                {(issues.missingDocuments ?? []).map((d) => (
                  <li key={`miss-${d}`}>Missing: {d.replace(/_/g, ' ')}</li>
                ))}
                {(issues.expiredDocuments ?? []).map((d) => (
                  <li key={`exp-${d}`}>Expired: {d.replace(/_/g, ' ')}</li>
                ))}
                {(issues.missingTraining ?? []).map((t) => (
                  <li key={`train-${t}`}>Training missing: {t.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isPending && (
          <p className="text-xs text-gray-400">Updating…</p>
        )}
      </div>

      {/* Future shift confirmation modal */}
      {shiftWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Future shifts assigned</h3>
            <p className="text-sm text-gray-600">
              This staff member has{' '}
              <span className="font-semibold text-orange-700">
                {shiftWarning.future_shift_count} upcoming shift{shiftWarning.future_shift_count !== 1 ? 's' : ''}
              </span>{' '}
              (next: {formatDate(shiftWarning.next_shift_date)}).
              Changing their status will not automatically unassign them.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShiftWarning(null)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmStatusChange(false)}
                  className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
                >
                  Continue anyway
                </button>
              </div>
              <button
                type="button"
                onClick={() => confirmStatusChange(true)}
                className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 text-center"
              >
                Continue and unassign future shifts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
