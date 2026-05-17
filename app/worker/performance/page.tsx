'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PerformanceData {
  attendance: {
    rate:             number
    completed_shifts: number
    total_shifts:     number
    missed_shifts:    number
  }
  visits: {
    submitted_notes: number
  }
  compliance: {
    score:         number
    total_docs:    number
    approved_docs: number
    expired_docs:  number
  }
  onboarding: {
    completed: boolean
    progress:  number
  }
  acknowledgements: Array<{
    id:                string
    title:             string
    shift_date:        string
    worker_ack_status: string
  }>
}

// ── SVG score ring ────────────────────────────────────────────────────────────

function ScoreRing({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r            = (size - 12) / 2
  const circumference = 2 * Math.PI * r
  const offset       = circumference * (1 - Math.min(value, 100) / 100)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${value}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth="6" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth="6" fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize="15" fontWeight="700" fill="#111827">
        {value}%
      </text>
    </svg>
  )
}

// ── Ack badge ─────────────────────────────────────────────────────────────────

const ACK_LABEL: Record<string, string> = {
  accepted:     'Confirmed',
  declined:     'Declined',
  running_late: 'Running late',
}
const ACK_CLS: Record<string, string> = {
  accepted:     'text-emerald-600 bg-emerald-50',
  declined:     'text-red-600 bg-red-50',
  running_late: 'text-amber-600 bg-amber-50',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkerPerformancePage() {
  const [data,    setData]    = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    const token = sessionStorage.getItem('worker_token')
    if (!token) { setError('Session expired.'); setLoading(false); return }
    fetch(`/api/worker/performance?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-40" />
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="h-36 bg-gray-100 rounded-xl" />)}</div>
      <div className="grid grid-cols-2 gap-3">{[1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}</div>
    </div>
  )

  if (error) return <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
  if (!data) return null

  const attColor      = data.attendance.rate >= 90 ? '#10b981' : data.attendance.rate >= 75 ? '#f59e0b' : '#ef4444'
  const compColor     = data.compliance.score >= 80 ? '#10b981' : '#f59e0b'
  const onboardColor  = data.onboarding.completed ? '#10b981' : '#6366f1'

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Progress</h1>
        <span className="text-xs text-gray-400">Last 30 days</span>
      </div>

      {/* Score rings */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
          <ScoreRing value={data.attendance.rate} color={attColor} />
          <p className="text-xs font-semibold text-gray-700 text-center leading-tight">Attendance</p>
          <p className="text-[10px] text-gray-400">{data.attendance.completed_shifts}/{data.attendance.total_shifts}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
          <ScoreRing value={data.compliance.score} color={compColor} />
          <p className="text-xs font-semibold text-gray-700 text-center leading-tight">Compliance</p>
          <p className="text-[10px] text-gray-400">{data.compliance.approved_docs}/{data.compliance.total_docs} docs</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
          <ScoreRing value={data.onboarding.progress} color={onboardColor} />
          <p className="text-xs font-semibold text-gray-700 text-center leading-tight">Onboarding</p>
          <p className="text-[10px] text-gray-400">{data.onboarding.completed ? 'Complete' : 'In progress'}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Visits Done</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{data.attendance.completed_shifts}</p>
          <p className="text-xs text-gray-400 mt-0.5">this month</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Visit Notes</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{data.visits.submitted_notes}</p>
          <p className="text-xs text-gray-400 mt-0.5">submitted</p>
        </div>

        {data.attendance.missed_shifts > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs text-red-500">Missed Shifts</p>
            <p className="text-3xl font-bold text-red-700 mt-1 tabular-nums">{data.attendance.missed_shifts}</p>
            <p className="text-xs text-red-400 mt-0.5">last 30 days</p>
          </div>
        )}

        {data.compliance.expired_docs > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-600">Expired Docs</p>
            <p className="text-3xl font-bold text-amber-700 mt-1 tabular-nums">{data.compliance.expired_docs}</p>
            <Link href="/worker/documents" className="text-xs text-amber-600 underline mt-0.5 block">Upload now →</Link>
          </div>
        )}
      </div>

      {/* Acknowledgement history */}
      {data.acknowledgements.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Recent Shift Responses</h2>
          <div className="space-y-2">
            {data.acknowledgements.map(ack => (
              <div key={ack.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{ack.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(ack.shift_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ml-3 shrink-0 ${ACK_CLS[ack.worker_ack_status] ?? 'text-gray-500 bg-gray-50'}`}>
                  {ACK_LABEL[ack.worker_ack_status] ?? ack.worker_ack_status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Links */}
      <div className="flex gap-3">
        <Link href="/worker/documents" className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-center text-sm font-medium text-gray-700 hover:border-indigo-300">
          Manage Documents
        </Link>
        <Link href="/worker/onboarding" className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-center text-sm font-medium text-gray-700 hover:border-indigo-300">
          Onboarding
        </Link>
      </div>
    </div>
  )
}
