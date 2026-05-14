'use client'

import { useState } from 'react'

export interface TerminationData {
  termination_date:   string
  termination_reason: string
  termination_notes:  string
}

export function TerminationModal({
  onConfirm,
  onCancel,
  isLoading,
}: {
  onConfirm:  (data: TerminationData) => void
  onCancel:   () => void
  isLoading:  boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date,   setDate]   = useState(today)
  const [reason, setReason] = useState('')
  const [notes,  setNotes]  = useState('')

  const canSubmit = date.trim() !== '' && reason.trim() !== ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600 text-[22px]">person_off</span>
          <h3 className="text-base font-semibold text-primary">Terminate Staff Member</h3>
        </div>

        <p className="text-sm text-gray-600">
          This will archive the staff member and hide them from active lists. All records are preserved.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Termination date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason for termination <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Resignation, End of contract, Misconduct…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Additional notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional context…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading || !canSubmit}
            onClick={() => onConfirm({ termination_date: date, termination_reason: reason, termination_notes: notes })}
            className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving…' : 'Confirm Termination'}
          </button>
        </div>
      </div>
    </div>
  )
}
