'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ActivationCheckResult, ActivationBlocker } from '@/app/api/admin/staff/[id]/activation-check/route'
import { TerminationModal, type TerminationData } from '@/components/admin/TerminationModal'

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


// ── Pre-flight activation modal ───────────────────────────────────────────────

function BlockerRow({ item, type }: { item: ActivationBlocker; type: 'blocker' | 'warning' }) {
  return (
    <li className={`flex items-start gap-2 text-sm py-1 ${type === 'blocker' ? 'text-red-700' : 'text-amber-700'}`}>
      <span className="flex-shrink-0 mt-0.5">{type === 'blocker' ? '✕' : '⚠'}</span>
      <span>{item.message}</span>
    </li>
  )
}

function ActivationPreflightModal({
  check,
  _pendingStatus,
  onConfirm,
  onCancel,
  isLoading,
}: {
  check:         ActivationCheckResult
  _pendingStatus: string
  onConfirm:     (force: boolean) => void
  onCancel:      () => void
  isLoading:     boolean
}) {
  const allClear = check.can_activate && check.warnings.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          {allClear ? (
            <span className="text-2xl">✅</span>
          ) : check.can_activate ? (
            <span className="text-2xl">⚠️</span>
          ) : (
            <span className="text-2xl">🚫</span>
          )}
          <h3 className="text-base font-semibold text-primary">
            {allClear
              ? 'All checks passed — ready to activate'
              : check.can_activate
              ? 'Activation has warnings'
              : 'Activation blocked'}
          </h3>
        </div>

        {/* Blockers */}
        {check.blockers.length > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-xs font-semibold text-red-800 mb-2 uppercase tracking-wide">Must resolve before activating</p>
            <ul className="space-y-0.5">
              {check.blockers.map((b, i) => (
                <BlockerRow key={i} item={b} type="blocker" />
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {check.warnings.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">Warnings (non-blocking)</p>
            <ul className="space-y-0.5">
              {check.warnings.map((w, i) => (
                <BlockerRow key={i} item={w} type="warning" />
              ))}
            </ul>
          </div>
        )}

        {/* All clear state */}
        {allClear && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            This staff member meets all compliance requirements and can be safely activated.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            {check.can_activate && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onConfirm(false)}
                className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Activating…' : 'Confirm — Activate'}
              </button>
            )}
          </div>
          {!check.can_activate && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onConfirm(true)}
              className="w-full rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Override — activate anyway (compliance risk)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Main component ────────────────────────────────────────────────────────────

export default function StaffStatusControl({
  staffProfileId,
  currentStatus,
  isCompliant,
}: StaffStatusControlProps) {
  const router = useRouter()
  const [error,            setError]          = useState<string | null>(null)
  const [issues,           setIssues]         = useState<ComplianceIssues | null>(null)
  const [isPending,        startTransition]   = useTransition()
  const [localStatus,      setLocalStatus]    = useState(currentStatus)
  const [shiftWarning,     setShiftWarning]   = useState<FutureShiftWarning | null>(null)
  const [activationCheck,  setActivationCheck] = useState<{ check: ActivationCheckResult; pendingStatus: string } | null>(null)
  const [checkLoading,     setCheckLoading]   = useState(false)
  const [showTermination,  setShowTermination] = useState(false)

  async function doStatusChange(newStatus: string, force = false, unassignShifts = false, terminationData?: TerminationData) {
    setError(null)
    setIssues(null)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/status`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: newStatus, force, unassign_shifts: unassignShifts, ...terminationData }),
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

  /** For activation: run pre-flight check first, show modal */
  async function handleActivation() {
    setCheckLoading(true)
    try {
      const res  = await fetch(`/api/admin/staff/${staffProfileId}/activation-check`)
      const json = await res.json() as ActivationCheckResult
      setActivationCheck({ check: json, pendingStatus: 'active' })
    } catch {
      setError('Failed to run activation check.')
    } finally {
      setCheckLoading(false)
    }
  }

  function handleStatusChange(newStatus: string) {
    if (newStatus === localStatus) return
    if (newStatus === 'active') {
      void handleActivation()
    } else if (newStatus === 'terminated') {
      setShowTermination(true)
    } else {
      void doStatusChange(newStatus, false)
    }
  }

  function handleTerminationConfirm(data: TerminationData) {
    setShowTermination(false)
    void doStatusChange('terminated', false, false, data)
  }

  function confirmActivation(force: boolean) {
    if (!activationCheck) return
    const pending = activationCheck.pendingStatus
    setActivationCheck(null)
    void doStatusChange(pending, force)
  }

  function confirmStatusChange(unassignShifts = false) {
    if (!shiftWarning) return
    const pending = shiftWarning.pendingStatus
    setShiftWarning(null)
    void doStatusChange(pending, true, unassignShifts)
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Staff Status</h2>
      </div>

      <div className="p-4 space-y-3">
        {/* Compliance warning for active */}
        {!isCompliant && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <span className="font-medium">⚠ Compliance incomplete.</span>{' '}
            Activating this staff member will run a full pre-flight check.
          </div>
        )}

        {/* Status buttons */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const isCurrent  = localStatus === s.value
            const isDisabled = isPending || checkLoading

            return (
              <button
                key={s.value}
                type="button"
                disabled={isDisabled}
                onClick={() => handleStatusChange(s.value)}
                className={[
                  'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                  s.cls,
                  isCurrent  ? 'ring-2 shadow-sm'              : '',
                  isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                {isCurrent && <span className="mr-1">●</span>}
                {s.label}
                {s.value === 'active' && checkLoading && <span className="ml-1">…</span>}
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

      {/* Termination confirmation modal */}
      {showTermination && (
        <TerminationModal
          onConfirm={handleTerminationConfirm}
          onCancel={() => setShowTermination(false)}
          isLoading={isPending}
        />
      )}

      {/* Activation pre-flight modal */}
      {activationCheck && (
        <ActivationPreflightModal
          check={activationCheck.check}
          pendingStatus={activationCheck.pendingStatus}
          onConfirm={confirmActivation}
          onCancel={() => setActivationCheck(null)}
          isLoading={isPending}
        />
      )}

      {/* Future shift confirmation modal */}
      {shiftWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-surface-container-lowest shadow-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-primary">Future shifts assigned</h3>
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
