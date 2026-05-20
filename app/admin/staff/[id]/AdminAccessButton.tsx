'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminAccessButtonProps {
  staffProfileId:    string
  adminInviteSentAt: string | null
}

export default function AdminAccessButton({ staffProfileId, adminInviteSentAt }: AdminAccessButtonProps) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/staff/${staffProfileId}/admin-access`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          send_email: true,
          // If already invited, use resend mode to bypass the 409 guard
          ...(adminInviteSentAt ? { resend: true } : {}),
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Failed to create admin access.')
        return
      }
      setDone(true)
      setTimeout(() => {
        setOpen(false)
        router.refresh()
      }, 1500)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        id="create-admin-access-btn"
        type="button"
        onClick={() => { setOpen(true); setError(null); setDone(false) }}
        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
          <path fillRule="evenodd" d="M15.5 8a.5.5 0 01.5.5v1h1a.5.5 0 010 1h-1v1a.5.5 0 01-1 0v-1h-1a.5.5 0 010-1h1v-1a.5.5 0 01.5-.5z" clipRule="evenodd" />
        </svg>
        {adminInviteSentAt ? 'Resend Admin Invite' : 'Create Admin Portal Access'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="relative w-full max-w-md rounded-lg bg-surface-container-lowest p-6 shadow-xl">
            {done ? (
              <div className="text-center py-4">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-base font-semibold text-primary">Admin account created</p>
                <p className="text-sm text-on-surface-variant mt-1">Invite email sent. Refreshing…</p>
              </div>
            ) : (
              <>
                <h2 className="text-base font-semibold text-primary mb-2">
                  Create Admin Portal Access
                </h2>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  This will create an admin portal login for this staff member and
                  send them an email to set up their password.
                </p>
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200 mb-5 leading-relaxed">
                  <strong>Note:</strong> Creating admin access does not automatically
                  promote the user. You must assign an operational role (e.g. Coordinator)
                  manually once their account is created.
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 mb-4">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    id="create-admin-access-cancel"
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    className="rounded-md bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-primary shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    id="create-admin-access-confirm"
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={loading}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                  >
                    {loading ? 'Creating…' : 'Create & Send Invite'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
