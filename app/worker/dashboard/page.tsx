'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface WorkerInfo {
  id:         string
  first_name: string | null
  last_name:  string | null
  email:      string | null
  status:     string
  job_role:   string | null
  start_date: string | null
}

interface Shift {
  id:         string
  title:      string
  shift_date: string
  start_time: string
  end_time:   string
  status:     string
  client_name: string | null
  location:   string | null
}

const STATUS_CLS: Record<string, string> = {
  pre_employment: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  active:         'bg-green-50  text-green-700  ring-green-600/20',
  suspended:      'bg-orange-50 text-orange-700 ring-orange-600/20',
  inactive:       'bg-gray-50   text-gray-600   ring-gray-500/20',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function WorkerDashboard() {
  const [worker, setWorker]   = useState<WorkerInfo | null>(null)
  const [nextShift, setNextShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const token = sessionStorage.getItem('worker_token')
    if (!token) {
      setError('Session expired. Please use your portal link again.')
      setLoading(false)
      return
    }

    Promise.all([
      fetch(`/api/worker/validate?token=${encodeURIComponent(token)}`).then((r) => r.json()),
      fetch(`/api/worker/shifts?token=${encodeURIComponent(token)}`).then((r) => r.json()),
    ])
      .then(([workerData, shiftsData]: [WorkerInfo & { error?: string }, Shift[] & { error?: string }]) => {
        if ((workerData as { error?: string }).error) {
          setError((workerData as { error?: string }).error ?? 'Session expired.')
          return
        }
        setWorker(workerData as WorkerInfo)

        const today    = new Date().toISOString().slice(0, 10)
        const upcoming = (Array.isArray(shiftsData) ? shiftsData : [])
          .filter((s) => s.shift_date >= today && s.status !== 'cancelled')
          .sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time))
        setNextShift(upcoming[0] ?? null)
      })
      .catch(() => setError('Failed to load dashboard — please try again.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
    )
  }

  if (!worker) return null

  const displayName = [worker.first_name, worker.last_name].filter(Boolean).join(' ') || 'Worker'
  const statusCls   = STATUS_CLS[worker.status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
          {worker.email && <p className="text-sm text-gray-500 mt-0.5">{worker.email}</p>}
        </div>
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusCls}`}>
          {worker.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-0.5">Job role</p>
          <p className="text-sm font-medium text-gray-900">{worker.job_role ?? '—'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-0.5">Start date</p>
          <p className="text-sm font-medium text-gray-900">{formatDate(worker.start_date)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-0.5">Status</p>
          <p className="text-sm font-medium text-gray-900">{worker.status.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Next shift */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Next shift</h2>
        {nextShift ? (
          <div className="text-sm text-gray-800 space-y-1">
            <p className="font-medium">{nextShift.title}</p>
            <p className="text-gray-600">{formatDate(nextShift.shift_date)} · {nextShift.start_time.slice(0, 5)}–{nextShift.end_time.slice(0, 5)}</p>
            {nextShift.client_name && <p className="text-gray-500">Client: {nextShift.client_name}</p>}
            {nextShift.location    && <p className="text-gray-500">Location: {nextShift.location}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No upcoming shifts.</p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/worker/shifts',       label: 'My Shifts',       desc: 'View all assigned shifts' },
          { href: '/worker/availability', label: 'My Availability',  desc: 'Update your weekly availability' },
          { href: '/worker/documents',    label: 'My Documents',    desc: 'View and upload documents' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block bg-white rounded-lg border border-gray-200 px-4 py-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
          >
            <p className="text-sm font-semibold text-gray-900">{item.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
