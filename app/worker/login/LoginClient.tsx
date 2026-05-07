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
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const [worker, setWorker] = useState<WorkerInfo | null>(null)
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
        // Store token for this session
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
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-gray-500">Verifying your access link…</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-lg bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-sm font-semibold text-red-700 mb-1">Access link invalid</p>
        <p className="text-sm text-red-600">{errorMsg}</p>
      </div>
    )
  }

  const displayName = [worker?.first_name, worker?.last_name].filter(Boolean).join(' ') || 'Worker'

  return (
    <div className="max-w-md mx-auto mt-16 rounded-lg bg-white border border-gray-200 p-8 text-center space-y-4">
      <div className="text-3xl">👋</div>
      <h1 className="text-lg font-semibold text-gray-900">Welcome, {displayName}</h1>
      {worker?.job_role && (
        <p className="text-sm text-gray-500">{worker.job_role}</p>
      )}
      <div className="pt-2">
        <Link
          href="/worker/dashboard"
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          Go to my dashboard →
        </Link>
      </div>
    </div>
  )
}
