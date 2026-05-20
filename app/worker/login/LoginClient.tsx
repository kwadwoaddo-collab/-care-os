'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface WorkerInfo {
  id:         string
  first_name: string | null
  last_name:  string | null
  status:     string
  job_role:   string | null
}

export default function LoginClient({ token }: { token: string }) {
  const [mode,     setMode]     = useState<'verify' | 'request-link'>('verify')
  const [state,    setState]    = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [worker,   setWorker]   = useState<WorkerInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [email,    setEmail]    = useState('')
  const [sentMsg,  setSentMsg]  = useState('')

  useEffect(() => {
    if (!token) {
      setMode('request-link')
      return
    }

    setState('loading')
    fetch(`/api/worker/validate?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json() as WorkerInfo & { error?: string }
        if (!res.ok) {
          setState('error')
          setErrorMsg(data.error ?? 'This login link has expired or is no longer valid.')
          return
        }
        sessionStorage.setItem('worker_token', token)
        setWorker(data)
        setState('success')
      })
      .catch(() => {
        setState('error')
        setErrorMsg('Network error — please try again.')
      })
  }, [token])

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email || state === 'loading') return

    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/worker/auth/magic-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json() as { ok?: boolean; message?: string; error?: string }
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to send link.')
        setState('error')
        return
      }
      setSentMsg(data.message ?? 'Success')
      setState('success')
    } catch {
      setErrorMsg('Network error — please try again.')
      setState('error')
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  // Verification Loading State
  if (mode === 'verify' && state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Verifying your access link…</p>
      </div>
    )
  }

  // Verification Success
  if (mode === 'verify' && state === 'success' && worker) {
    const displayName = [worker.first_name, worker.last_name].filter(Boolean).join(' ') || 'Worker'
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest border border-gray-200 p-8 text-center shadow-sm space-y-5 animate-in fade-in zoom-in duration-300">
          <div className="text-4xl">👋</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Welcome, {displayName}</h1>
            {worker.job_role && <p className="text-sm text-gray-500 mt-1">{worker.job_role}</p>}
          </div>
          <Link
            href="/worker/dashboard"
            className="block w-full rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all shadow-md shadow-indigo-200"
          >
            Go to my dashboard →
          </Link>
        </div>
      </div>
    )
  }

  // Verification Error / Request Link Form
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest border border-gray-200 p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-2xl mb-4">
            {state === 'error' ? '🔒' : '🔑'}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {state === 'error' ? 'Invalid Link' : 'Worker Portal Login'}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {state === 'error' 
              ? errorMsg 
              : 'Enter your email address to receive a fresh magic login link for your portal.'}
          </p>
        </div>

        {state === 'success' && sentMsg ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center animate-in slide-in-from-top-2 duration-300">
            <p className="text-sm font-semibold text-green-800">Check your inbox</p>
            <p className="text-xs text-green-700 mt-1">{sentMsg}</p>
            <button 
              onClick={() => { setState('idle'); setSentMsg('') }}
              className="mt-4 text-xs font-medium text-green-800 underline underline-offset-2 hover:text-green-900"
            >
              Try another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleRequestLink} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 ml-1">
                Work Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={state === 'loading'}
                className="block w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-indigo-500 focus:bg-surface-container-lowest focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
            </div>

            {errorMsg && mode === 'request-link' && (
              <p className="text-xs font-medium text-red-600 ml-1">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={state === 'loading'}
              className="group relative flex w-full justify-center rounded-xl bg-indigo-600 px-3 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-100 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {state === 'loading' ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending…
                </span>
              ) : (
                'Send Login Link →'
              )}
            </button>
          </form>
        )}

        <div className="pt-2 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            Trouble logging in? Contact your company administrator or HR team for assistance.
          </p>
        </div>
      </div>
    </div>
  )
}
