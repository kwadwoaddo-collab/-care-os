'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  applicantId: string
  currentStatus: string
}

type ActionStatus    = 'idle' | 'saving' | 'success' | 'error'
type ConvertStatus   = 'idle' | 'loading' | 'done' | 'error'

const STATUS_BADGE_MAP: Record<string, string> = {
  applied:              'bg-blue-50 text-blue-700 ring-blue-600/20',
  shortlisted:          'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  rejected:             'bg-red-50 text-red-700 ring-red-600/20',
  interview_scheduled:  'bg-purple-50 text-purple-700 ring-purple-600/20',
  hired:                'bg-green-50 text-green-700 ring-green-600/20',
  withdrawn:            'bg-gray-50 text-gray-600 ring-gray-500/20',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE_MAP[status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const ACTIONS: { label: string; targetStatus: string; btnCls: string }[] = [
  {
    label:        'Shortlist',
    targetStatus: 'shortlisted',
    btnCls:       'bg-yellow-50 text-yellow-700 ring-yellow-600/20 hover:bg-yellow-100',
  },
  {
    label:        'Schedule Interview',
    targetStatus: 'interview_scheduled',
    btnCls:       'bg-purple-50 text-purple-700 ring-purple-600/20 hover:bg-purple-100',
  },
  {
    label:        'Hire',
    targetStatus: 'hired',
    btnCls:       'bg-green-50 text-green-700 ring-green-600/20 hover:bg-green-100',
  },
  {
    label:        'Reject',
    targetStatus: 'rejected',
    btnCls:       'bg-red-50 text-red-700 ring-red-600/20 hover:bg-red-100',
  },
]

export default function ApplicantActions({ applicantId, currentStatus }: Props) {
  const [status, setStatus]             = useState(currentStatus)
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle')
  const [message, setMessage]           = useState<string | null>(null)

  const [convertStatus, setConvertStatus]   = useState<ConvertStatus>('idle')
  const [convertMessage, setConvertMessage] = useState<string | null>(null)
  const [staffProfileId, setStaffProfileId] = useState<string | null>(null)

  async function handleAction(targetStatus: string) {
    setActionStatus('saving')
    setMessage(null)

    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: targetStatus }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Request failed with status ${res.status}`)
      }

      setStatus(targetStatus)
      setActionStatus('success')
      setMessage(`Status updated to "${targetStatus.replace(/_/g, ' ')}"`)
    } catch (err) {
      setActionStatus('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  async function handleConvert() {
    setConvertStatus('loading')
    setConvertMessage(null)
    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}/convert`, {
        method: 'POST',
      })
      const body = await res.json() as {
        staff_profile?: { id: string }
        already_converted?: boolean
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      setStaffProfileId(body.staff_profile?.id ?? null)
      setConvertStatus('done')
      setConvertMessage(
        body.already_converted ? 'Already converted — staff profile exists.' : 'Staff profile created.'
      )
    } catch (err) {
      setConvertStatus('error')
      setConvertMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const isSaving = actionStatus === 'saving'

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Current status display */}
        <div className="flex items-center gap-1.5 mr-2">
          <span className="text-xs text-on-surface-variant font-medium">Status:</span>
          <StatusBadge status={status} />
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Action buttons */}
        {ACTIONS.map((action) => {
          const isActive = status === action.targetStatus
          return (
            <button
              key={action.targetStatus}
              id={`action-${action.targetStatus}`}
              onClick={() => handleAction(action.targetStatus)}
              disabled={isSaving || isActive}
              className={[
                'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                action.btnCls,
                isActive ? 'opacity-40 cursor-not-allowed' : isSaving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {isSaving && !isActive ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {action.label}
                </span>
              ) : (
                action.label
              )}
            </button>
          )
        })}
      </div>

      {/* Feedback message */}
      {message && (
        <p
          className={`mt-2 text-xs ${
            actionStatus === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {actionStatus === 'success' ? '✓ ' : '✕ '}
          {message}
        </p>
      )}

      {/* Convert to Staff — only shown when hired */}
      {status === 'hired' && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
          <button
            id="btn-convert-to-staff"
            onClick={handleConvert}
            disabled={convertStatus === 'loading' || convertStatus === 'done'}
            className={[
              'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
              convertStatus === 'done'
                ? 'bg-green-50 text-green-700 ring-green-600/20 opacity-60 cursor-not-allowed'
                : convertStatus === 'loading'
                ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 opacity-60 cursor-not-allowed'
                : 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 hover:bg-indigo-100 cursor-pointer',
            ].join(' ')}
          >
            {convertStatus === 'loading' ? (
              <span className="flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Converting…
              </span>
            ) : convertStatus === 'done' ? (
              '✓ Staff profile created'
            ) : (
              'Convert to Staff'
            )}
          </button>

          {convertStatus === 'done' && staffProfileId && (
            <Link
              href={`/admin/staff/${staffProfileId}`}
              className="text-xs text-indigo-600 underline hover:text-indigo-800 transition-colors"
            >
              View staff profile →
            </Link>
          )}

          {convertMessage && convertStatus === 'error' && (
            <p className="text-xs text-red-600">✕ {convertMessage}</p>
          )}
        </div>
      )}
    </div>
  )
}
