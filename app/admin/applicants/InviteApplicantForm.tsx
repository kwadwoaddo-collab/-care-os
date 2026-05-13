'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface InviteResult {
  applicant_id: string
  magic_link: string
  expires_at: string
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  job_role: '',
}

export default function InviteApplicantForm() {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleOpen() {
    setOpen(true)
    setFields(EMPTY_FORM)
    setError(null)
    setResult(null)
    setCopied(false)
  }

  function handleClose() {
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/applicants/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: fields.first_name.trim(),
          last_name: fields.last_name.trim(),
          email: fields.email.trim(),
          phone: fields.phone.trim() || undefined,
          job_role: fields.job_role.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (Array.isArray(data.errors)) {
          setError(data.errors.join('\n'))
        } else {
          setError(data.error ?? 'Something went wrong')
        }
        return
      }

      setResult(data as InviteResult)
      router.refresh()
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
        onClick={handleOpen}
        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Invite Applicant
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-primary mb-4">Invite Applicant</h2>

            {result ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                  Invite sent successfully.
                </div>

                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Applicant ID</dt>
                    <dd className="mt-0.5 font-mono text-gray-800 break-all">{result.applicant_id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Expires</dt>
                    <dd className="mt-0.5 text-gray-800">
                      {new Date(result.expires_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Magic Link</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-gray-700 bg-gray-50 rounded p-2">
                      {result.magic_link}
                    </dd>
                  </div>
                </dl>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    {copied ? 'Copied!' : 'Copy Magic Link'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First name</label>
                    <input
                      name="first_name"
                      value={fields.first_name}
                      onChange={handleChange}
                      required
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last name</label>
                    <input
                      name="last_name"
                      value={fields.last_name}
                      onChange={handleChange}
                      required
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    name="email"
                    type="email"
                    value={fields.email}
                    onChange={handleChange}
                    required
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
                  <input
                    name="phone"
                    type="tel"
                    value={fields.phone}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Job role</label>
                  <input
                    name="job_role"
                    value={fields.job_role}
                    onChange={handleChange}
                    required
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Send Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
