'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = [
  { value: 'active', label: 'Active',  cls: 'bg-green-50  text-green-700  ring-green-600/20  hover:bg-green-100' },
  { value: 'paused', label: 'Paused',  cls: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 hover:bg-yellow-100' },
  { value: 'ended',  label: 'Ended',   cls: 'bg-gray-50   text-on-surface-variant   ring-gray-400/20   hover:bg-gray-100' },
] as const

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface ShiftWarning {
  unassigned_shift_count: number
  next_shift_date:        string
  pendingStatus:          string
}

interface Props {
  packageId:     string
  currentStatus: string
}

export default function CarePackageStatusControl({ packageId, currentStatus }: Props) {
  const router = useRouter()
  const [isPending,     startTransition] = useTransition()
  const [error,         setError]        = useState<string | null>(null)
  const [localStatus,   setLocalStatus]  = useState(currentStatus)
  const [shiftWarning,  setShiftWarning] = useState<ShiftWarning | null>(null)
  const [result,        setResult]       = useState<{ cancelled: number; skipped: number } | null>(null)

  async function doStatusChange(newStatus: string, force = false, cancelUnassigned = false) {
    setError(null)
    setResult(null)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/care-packages/${packageId}/status`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            status:                   newStatus,
            force,
            cancel_unassigned_shifts: cancelUnassigned,
          }),
        })

        const json = await res.json() as {
          error?:                   string
          needs_confirmation?:      boolean
          unassigned_shift_count?:  number
          next_shift_date?:         string
          cancelled_shifts?:        number
          skipped_assigned_shifts?: number
        }

        if (!res.ok) {
          setError(json.error ?? 'Failed to update status')
          return
        }

        if (json.needs_confirmation) {
          setShiftWarning({
            unassigned_shift_count: json.unassigned_shift_count ?? 0,
            next_shift_date:        json.next_shift_date ?? '',
            pendingStatus:          newStatus,
          })
          return
        }

        setLocalStatus(newStatus)
        if ((json.cancelled_shifts ?? 0) > 0 || (json.skipped_assigned_shifts ?? 0) > 0) {
          setResult({
            cancelled: json.cancelled_shifts        ?? 0,
            skipped:   json.skipped_assigned_shifts ?? 0,
          })
        }
        router.refresh()
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  function handleStatusChange(newStatus: string) {
    if (newStatus === localStatus) return
    void doStatusChange(newStatus, false)
  }

  function confirm(cancelUnassigned: boolean) {
    if (!shiftWarning) return
    const pending = shiftWarning.pendingStatus
    setShiftWarning(null)
    void doStatusChange(pending, true, cancelUnassigned)
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => {
          const isCurrent = localStatus === s.value
          return (
            <button
              key={s.value}
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange(s.value)}
              className={[
                'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                s.cls,
                isCurrent  ? 'ring-2 shadow-sm'             : '',
                isPending  ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {isCurrent && <span className="mr-1">●</span>}
              {s.label}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {result && (
        <p className="mt-1 text-xs text-on-surface-variant">
          {result.cancelled} shift{result.cancelled !== 1 ? 's' : ''} cancelled
          {result.skipped > 0 && ` · ${result.skipped} assigned shift${result.skipped !== 1 ? 's' : ''} skipped`}
        </p>
      )}

      {/* Confirmation modal */}
      {shiftWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-surface-container-lowest shadow-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-primary">Unassigned future shifts exist</h3>
            <p className="text-sm text-gray-600">
              This package has{' '}
              <span className="font-semibold text-orange-700">
                {shiftWarning.unassigned_shift_count} unassigned scheduled shift{shiftWarning.unassigned_shift_count !== 1 ? 's' : ''}
              </span>{' '}
              (next: {formatDate(shiftWarning.next_shift_date)}).
            </p>
            <p className="text-xs text-on-surface-variant">
              Assigned shifts will not be affected automatically.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShiftWarning(null)}
                  className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirm(false)}
                  className="flex-1 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
                >
                  Change status only
                </button>
              </div>
              <button
                type="button"
                onClick={() => confirm(true)}
                className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Change status and cancel unassigned shifts
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
