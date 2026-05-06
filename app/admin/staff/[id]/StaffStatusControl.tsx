'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = [
  { value: 'pre_employment', label: 'Pre-employment', cls: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 hover:bg-yellow-100' },
  { value: 'active',         label: 'Active',         cls: 'bg-green-50  text-green-700  ring-green-600/20  hover:bg-green-100' },
  { value: 'suspended',      label: 'Suspended',      cls: 'bg-orange-50 text-orange-700 ring-orange-600/20 hover:bg-orange-100' },
  { value: 'inactive',       label: 'Inactive',       cls: 'bg-gray-50   text-gray-600   ring-gray-500/20   hover:bg-gray-100' },
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

export default function StaffStatusControl({
  staffProfileId,
  currentStatus,
  isCompliant,
}: StaffStatusControlProps) {
  const router = useRouter()
  const [error,      setError]      = useState<string | null>(null)
  const [issues,     setIssues]     = useState<ComplianceIssues | null>(null)
  const [isPending,  startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState(currentStatus)

  async function handleStatusChange(newStatus: string) {
    if (newStatus === localStatus) return
    setError(null)
    setIssues(null)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        const json = await res.json() as {
          error?: string
          compliance?: ComplianceIssues
          staff_profile?: { status: string }
        }

        if (!res.ok) {
          setError(json.error ?? 'Failed to update status.')
          if (json.compliance) setIssues(json.compliance)
          return
        }

        setLocalStatus(newStatus)
        router.refresh()
      } catch {
        setError('Network error — please try again.')
      }
    })
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
    </div>
  )
}
