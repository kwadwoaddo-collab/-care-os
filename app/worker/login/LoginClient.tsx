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
  const [state,    setState]    = useState<'loading' | 'success' | 'error'>('loading')
  const [worker,   setWorker]   = useState<WorkerInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setErrorMsg('No access token found in this link. Please use the link from your invitation email.')
      return
    }

    fetch(`/api/worker/validate?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json() as WorkerInfo & { error?: string }
        if (!res.ok) {
          setState('error')
          setErrorMsg(data.error ?? 'Invalid or expired link.')
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

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-gray-500">Verifying your access link…</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-sm rounded-2xl bg-red-50 border border-red-200 p-6 text-center space-y-3">
          <span className="text-3xl">🔒</span>
          <p className="text-base font-semibold text-red-700">Access link invalid</p>
          <p className="text-sm text-red-600">{errorMsg}</p>
          <p className="text-xs text-red-500 pt-1">
            Ask your manager to resend your worker portal invite.
          </p>
        </div>
      </div>
    )
  }

  const displayName = [worker?.first_name, worker?.last_name].filter(Boolean).join(' ') || 'Worker'

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-5">
        <div className="text-4xl">👋</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Welcome, {displayName}</h1>
          {worker?.job_role && (
            <p className="text-sm text-gray-500 mt-1">{worker.job_role}</p>
          )}
        </div>
        <Link
          href="/worker/dashboard"
          className="block w-full rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all"
        >
          Go to my dashboard →
        </Link>
      </div>
    </div>
  )
}
