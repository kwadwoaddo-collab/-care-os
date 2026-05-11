'use client'

/**
 * Admin Onboarding Queue
 *
 * Filtered view of all staff onboarding progress.
 * HR teams can quickly see who needs review, who is blocked, and take action.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { OnboardingRow, OnboardingResponse, OnboardingSummary } from '@/app/api/admin/onboarding/route'

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = 'all' | 'not_started' | 'in_progress' | 'awaiting_review' | 'complete'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Stage badge ───────────────────────────────────────────────────────────────

const STAGE_CLS: Record<string, string> = {
  not_started:     'bg-gray-50    text-gray-600   ring-gray-400/30',
  in_progress:     'bg-blue-50    text-blue-700   ring-blue-500/30',
  awaiting_review: 'bg-amber-50   text-amber-700  ring-amber-500/30',
  complete:        'bg-green-50   text-green-700  ring-green-500/30',
}

const STAGE_LABEL: Record<string, string> = {
  not_started:     'Not started',
  in_progress:     'In progress',
  awaiting_review: 'Awaiting review',
  complete:        'Complete',
}

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_CLS[stage] ?? 'bg-gray-50 text-gray-600 ring-gray-400/30'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {STAGE_LABEL[stage] ?? stage}
    </span>
  )
}

// ── Gap badges ────────────────────────────────────────────────────────────────

function GapBadge({ label, urgent }: { label: string; urgent?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
      urgent ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
    }`}>
      {label}
    </span>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const cls = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-indigo-500' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

// ── Send reminder button ──────────────────────────────────────────────────────

function SendReminderButton({ staffId }: { staffId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function send() {
    setState('sending')
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/reminder`, { method: 'POST' })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 4000)
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); void send() }}
      disabled={state !== 'idle'}
      className={[
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
        state === 'done'    ? 'bg-green-50 text-green-700 ring-green-600/20'  : '',
        state === 'error'   ? 'bg-red-50   text-red-700   ring-red-600/20'    : '',
        state === 'sending' ? 'opacity-60 cursor-not-allowed bg-gray-50 text-gray-500 ring-gray-400/20' : '',
        state === 'idle'    ? 'bg-white text-gray-600 ring-gray-300/60 hover:bg-gray-50' : '',
      ].join(' ')}
    >
      {state === 'done' ? '✓ Sent' : state === 'error' ? '✕ Failed' : state === 'sending' ? '…' : '📧 Remind'}
    </button>
  )
}

// ── Onboarding row ────────────────────────────────────────────────────────────

function OnboardingCard({ row }: { row: OnboardingRow }) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Unknown'

  return (
    <Link
      href={`/admin/staff/${row.id}`}
      className={`block rounded-xl border bg-white px-4 py-3.5 hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors group ${
        row.is_urgent ? 'border-red-200 ring-1 ring-red-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 truncate">{name}</p>
            {row.is_urgent && (
              <span className="flex-shrink-0 inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-200">
                Urgent
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{row.job_role ?? '—'}</p>

          <div className="mt-2">
            <ProgressBar pct={row.progress} />
          </div>

          {/* Gap badges */}
          {(row.missing_documents || row.missing_compliance || row.missing_policy || row.missing_hmrc || row.missing_banking) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {row.missing_documents  && <GapBadge label="Docs missing" urgent />}
              {row.missing_compliance && <GapBadge label="Compliance" urgent />}
              {row.missing_policy     && <GapBadge label="Policy" />}
              {row.missing_hmrc       && <GapBadge label="HMRC" />}
              {row.missing_banking    && <GapBadge label="Bank" />}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StageBadge stage={row.stage} />
          {row.start_date && (
            <p className="text-xs text-gray-400">Start: {formatDate(row.start_date)}</p>
          )}
          {row.stage !== 'complete' && (
            <SendReminderButton staffId={row.id} />
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, count, active, onClick, cls,
}: {
  label:   string
  count:   number
  active:  boolean
  onClick: () => void
  cls:     string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm ${cls} ${
        active ? 'ring-2 ring-indigo-400 shadow-sm' : ''
      }`}
    >
      <p className="text-xs font-medium opacity-60 mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{count}</p>
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100" />)}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100" />)}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingQueuePage() {
  const [stage,   setStage]   = useState<Stage>('all')
  const [data,    setData]    = useState<OnboardingRow[]>([])
  const [summary, setSummary] = useState<OnboardingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback((s: Stage) => {
    setLoading(true)
    setError(null)
    const url = s === 'all' ? '/api/admin/onboarding' : `/api/admin/onboarding?stage=${s}`
    fetch(url)
      .then(async (res) => {
        const json = await res.json() as OnboardingResponse | { error: string }
        if (!res.ok) { setError((json as { error: string }).error ?? 'Failed to load'); return }
        const r = json as OnboardingResponse
        setData(r.data)
        setSummary(r.summary)
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load('all') }, [load])

  function switchStage(s: Stage) {
    setStage(s)
    load(s)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Onboarding Queue</h1>
          {summary && (
            <p className="text-sm text-gray-500 mt-0.5">
              {summary.total} staff · {summary.awaiting_review} awaiting review · {summary.complete} complete
            </p>
          )}
        </div>
        <Link
          href="/admin/staff/new"
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          + Add staff
        </Link>
      </div>

      {/* Summary cards — clickable filters */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="All"
            count={summary.total}
            active={stage === 'all'}
            onClick={() => switchStage('all')}
            cls="bg-white border-gray-200 text-gray-900"
          />
          <SummaryCard
            label="Awaiting review"
            count={summary.awaiting_review}
            active={stage === 'awaiting_review'}
            onClick={() => switchStage('awaiting_review')}
            cls={summary.awaiting_review > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-gray-200 text-gray-900'}
          />
          <SummaryCard
            label="In progress"
            count={summary.in_progress}
            active={stage === 'in_progress'}
            onClick={() => switchStage('in_progress')}
            cls="bg-blue-50 border-blue-200 text-blue-900"
          />
          <SummaryCard
            label="Complete"
            count={summary.complete}
            active={stage === 'complete'}
            onClick={() => switchStage('complete')}
            cls="bg-green-50 border-green-200 text-green-900"
          />
        </div>
      )}

      {/* Stage tab strip */}
      <div className="flex gap-1 flex-wrap">
        {(['all', 'not_started', 'in_progress', 'awaiting_review', 'complete'] as Stage[]).map((s) => (
          <button
            key={s}
            onClick={() => switchStage(s)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              stage === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {STAGE_LABEL[s] ?? 'All'}
          </button>
        ))}
      </div>

      {loading && <Skeleton />}

      {!loading && error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Queue */}
      {!loading && !error && (
        <>
          {data.length === 0 ? (
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
              {stage === 'all' ? 'No staff profiles found.' : `No staff in "${STAGE_LABEL[stage]}" stage.`}
            </div>
          ) : (
            <div className="space-y-2">
              {data.map((row) => (
                <OnboardingCard key={row.id} row={row} />
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 text-right">
            {data.length} result{data.length !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  )
}
