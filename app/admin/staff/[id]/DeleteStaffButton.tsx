'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteStaffButtonProps {
  staffProfileId: string
  staffName: string
}

export default function DeleteStaffButton({ staffProfileId, staffName }: DeleteStaffButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${staffProfileId}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Failed to delete staff member.')
        return
      }
      router.push('/admin/staff')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canConfirm = confirmText.toLowerCase() === 'delete'

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null); setConfirmText('') }}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px]">delete</span>
        Delete Staff Member
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-md rounded-xl bg-surface-container-lowest shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[24px]">warning</span>
              <h3 className="text-base font-semibold text-primary">Delete Staff Member</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              This will permanently delete <span className="font-semibold text-primary">{staffName}</span> and all associated compliance records. Any future assigned shifts will be unassigned.
            </p>

            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <strong>This action cannot be undone.</strong> Type <span className="font-mono font-bold">delete</span> below to confirm.
            </div>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "delete" to confirm'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
              autoFocus
            />

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={loading || !canConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Deleting…' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
