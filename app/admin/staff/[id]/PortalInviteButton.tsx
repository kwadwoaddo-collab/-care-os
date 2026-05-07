'use client'

import { useState } from 'react'

interface InviteResult {
  magic_link: string
  expires_at: string
}

export default function PortalInviteButton({ staffProfileId }: { staffProfileId: string }) {
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<InviteResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)
  const [open,    setOpen]    = useState(false)

  async function handleClick() {
    setOpen(true)
    setError(null)
    setResult(null)
    setCopied(false)
    setLoading(true)

    try {
      const res  = await fetch(`/api/admin/staff/${staffProfileId}/portal-invite`, { method: 'POST' })
      const data = await res.json() as InviteResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setResult(data)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result.magic_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Send Worker Portal Invite
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Worker Portal Invite</h2>

            {loading && <p className="text-sm text-gray-500">Sending invite…</p>}

            {!loading && error && (
              <div className="space-y-4">
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
                <button type="button" onClick={() => setOpen(false)}
                  className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            )}

            {!loading && result && (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                  Portal invite sent successfully.
                </div>

                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expires</dt>
                    <dd className="mt-0.5 text-gray-800">
                      {new Date(result.expires_at).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Portal Link</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-gray-700 bg-gray-50 rounded p-2">
                      {result.magic_link}
                    </dd>
                  </div>
                </dl>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={handleCopy}
                    className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button type="button" onClick={() => setOpen(false)}
                    className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
