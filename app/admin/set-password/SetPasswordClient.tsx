'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

export default function SetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function checkSession() {
      if (urlError) {
        setError('Invitation link expired or invalid. Please request a new invite.')
        setLoading(false)
        return
      }

      // Supabase browser client handles fragments automatically.
      // We check if we have a session.
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()

      if (sessionErr) {
        setError('The invite link is invalid or has already been used.')
        setLoading(false)
        return
      }

      if (!session) {
        // No session — might be an expired token or manual visit
        setError('No active invitation found. Please check your email for the correct link.')
        setLoading(false)
        return
      }

      // We have a session (likely from the invite/recovery hash)
      setLoading(false)
    }

    void checkSession()
  }, [supabase.auth])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: updateErr } = await supabase.auth.updateUser({ password })

    if (updateErr) {
      setError(updateErr.message)
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)

    // Clear hash from URL for security/cleanliness
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname)
    }

    // Redirect after a short delay
    setTimeout(() => {
      router.push('/admin')
      router.refresh()
    }, 1500)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
        <p className="text-sm text-on-surface-variant">Verifying your invitation…</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center py-6 space-y-4 animate-in fade-in duration-500">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 text-2xl">
          ✓
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary">Password set</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Your admin account is ready. Redirecting you to the dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
          Create Password
        </h2>
        <p className="text-xs text-on-surface-variant">
          Choose a secure password for your admin portal access.
        </p>
      </div>

      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label htmlFor="pass" className="block text-xs font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="pass"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-primary placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="••••••••"
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-xs font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-primary placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="••••••••"
            disabled={submitting}
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Setting password…' : 'Complete Setup →'}
        </button>
      </form>

      <div className="pt-2 text-center">
        <p className="text-[11px] text-gray-400">
          This is a secure connection. Your password is never stored in plain text.
        </p>
      </div>
    </div>
  )
}
