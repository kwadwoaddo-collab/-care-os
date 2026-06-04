'use client'

/**
 * Admin Onboarding Queue
 *
 * Filtered, searchable view of all staff onboarding progress.
 * Supports bulk reminders, stage filters, search, stalled warnings.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
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
  all:             'All',
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
      urgent ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-on-surface-variant'
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
      <span className="text-xs text-on-surface-variant w-8 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

// ── Send reminder button (single row) ─────────────────────────────────────────

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
      id={`remind-${staffId}`}
      onClick={(e) => { e.preventDefault(); void send() }}
      disabled={state !== 'idle'}
      className={[
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
        state === 'done'    ? 'bg-green-50 text-green-700 ring-green-600/20'  : '',
        state === 'error'   ? 'bg-red-50   text-red-700   ring-red-600/20'    : '',
        state === 'sending' ? 'opacity-60 cursor-not-allowed bg-gray-50 text-on-surface-variant ring-gray-400/20' : '',
        state === 'idle'    ? 'bg-surface-container-lowest text-gray-600 ring-gray-300/60 hover:bg-gray-50' : '',
      ].join(' ')}
    >
      {state === 'done' ? '✓ Sent' : state === 'error' ? '✕ Failed' : state === 'sending' ? '…' : '📧 Remind'}
    </button>
  )
}

// ── Onboarding row card ───────────────────────────────────────────────────────

function OnboardingCard({
  row,
  selected,
  onToggle,
}: {
  row:       OnboardingRow
  selected:  boolean
  onToggle:  (id: string) => void
}) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Unknown'
  const isStalled = row.stalled_days !== null

  return (
    <div className={`flex items-start gap-3 rounded-xl border bg-surface-container-lowest px-3 py-3.5 transition-colors group ${
      row.is_urgent  ? 'border-red-200 ring-1 ring-red-200'   :
      isStalled      ? 'border-amber-200 ring-1 ring-amber-200' :
                       'border-gray-200'
    }`}>
      {/* Checkbox */}
      <label className="mt-0.5 flex-shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(row.id)}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          aria-label={`Select ${name}`}
        />
      </label>

      {/* Main content — link to staff detail */}
      <Link href={`/admin/staff/${row.id}`} className="flex-1 min-w-0 block">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-semibold text-primary group-hover:text-indigo-700 truncate">{name}</p>
              {row.is_urgent && (
                <span className="flex-shrink-0 inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-200">
                  Urgent
                </span>
              )}
              {isStalled && !row.is_urgent && (
                <span className="flex-shrink-0 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200">
                  Stalled {row.stalled_days}d
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant truncate">{row.job_role ?? '—'}</p>

            <div className="mt-2">
              <ProgressBar pct={row.progress} />
            </div>

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
    </div>
  )
}

// ── Triage metric card ────────────────────────────────────────────────────────

function TriageMetric({ label, count, subtitle, icon, iconCls }: {
  label: string; count: number; subtitle: string; icon: string; iconCls: string
}) {
  return (
    <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
      <div className="flex justify-between items-start mb-4">
        <span className="text-on-surface-variant font-label-md text-label-md">{label}</span>
        <span className={`material-symbols-outlined p-2 rounded-lg ${iconCls}`}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display-lg text-display-lg">{count}</span>
        <span className="text-[12px] font-semibold text-on-surface-variant">{subtitle}</span>
      </div>
    </div>
  )
}

// ── Bulk reminder bar ─────────────────────────────────────────────────────────

function BulkReminderBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[]
  onClear:     () => void
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [results, setResults] = useState<{ sent: number; failed: number } | null>(null)

  async function sendAll() {
    setState('sending')
    const settled = await Promise.allSettled(
      selectedIds.map((id) =>
        fetch(`/api/admin/staff/${id}/reminder`, { method: 'POST' })
          .then((r) => ({ ok: r.ok }))
          .catch(() => ({ ok: false }))
      )
    )
    const sent   = settled.filter((s) => s.status === 'fulfilled' && (s.value as { ok: boolean }).ok).length
    const failed = selectedIds.length - sent
    setResults({ sent, failed })
    setState('done')
    setTimeout(() => { setState('idle'); setResults(null); onClear() }, 5000)
  }

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 shadow-sm">
      <p className="text-sm font-medium text-indigo-800">
        {state === 'done' && results
          ? `✓ ${results.sent} sent${results.failed > 0 ? ` · ${results.failed} failed` : ''}`
          : `${selectedIds.length} worker${selectedIds.length !== 1 ? 's' : ''} selected`}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Clear
        </button>
        <button
          onClick={() => void sendAll()}
          disabled={state !== 'idle'}
          id="bulk-remind-btn"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {state === 'sending' ? 'Sending…' : `📧 Send reminders to ${selectedIds.length}`}
        </button>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100" />)}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100" />)}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingQueuePage() {
  const [stage,       setStage]       = useState<Stage>('all')
  const [data,        setData]        = useState<OnboardingRow[]>([])
  const [summary,     setSummary]     = useState<OnboardingSummary | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [urgentOnly,  setUrgentOnly]  = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback((s: Stage) => {
    setLoading(true)
    setError(null)
    setSelected(new Set())
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
    setSearch('')
    setUrgentOnly(false)
    load(s)
  }

  // Client-side search + urgent filter
  const filtered = data.filter((r) => {
    if (urgentOnly && !r.is_urgent && r.stalled_days === null) return false
    if (!search) return true
    const q    = search.toLowerCase()
    const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.toLowerCase()
    return name.includes(q) || (r.email ?? '').toLowerCase().includes(q)
  })

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((r) => r.id)))
    }
  }

  const selectedIds = [...selected]
  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const stalledRows = data.filter((r) => r.stalled_days !== null)

  return (
    <div className="space-y-6">

      {/* Mobile header */}
      <MobilePageHeader
        title="Onboarding"
        subtitle="Staff onboarding pipeline, progress tracking, and stalled alerts."
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Onboarding Queue</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Staff onboarding pipeline, progress tracking, and stalled alerts.
          </p>
        </div>
        <Link
          href="/admin/applicants"
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold bg-primary text-on-primary hover:opacity-90 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          Invite Applicant
        </Link>
      </div>

      {/* Stalled warning banner */}
      {stalledRows.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-base">⏰</span>
            <p className="text-sm font-medium text-amber-800">
              {stalledRows.length} worker{stalledRows.length !== 1 ? 's' : ''} stalled — in progress for 7+ days with no update
            </p>
          </div>
          <button
            onClick={() => { setStage('in_progress'); setUrgentOnly(true); load('in_progress') }}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap"
          >
            Show stalled →
          </button>
        </div>
      )}

      {/* Triage Metrics Row */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TriageMetric label="Awaiting Review" count={summary.awaiting_review} subtitle={`of ${summary.total} total`} icon="rate_review" iconCls="text-primary bg-primary-fixed" />
          <TriageMetric label="In Progress" count={summary.in_progress} subtitle={summary.stalled_count > 0 ? `${summary.stalled_count} stalled` : 'on track'} icon="pending_actions" iconCls="text-secondary bg-secondary-fixed" />
          <TriageMetric label="Complete" count={summary.complete} subtitle={`${summary.total > 0 ? Math.round((summary.complete / summary.total) * 100) : 0}% completion`} icon="check_circle" iconCls="text-on-tertiary-fixed-variant bg-tertiary-fixed" />
        </div>
      )}

      {/* Search + filters row */}
      <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant space-y-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input
            ref={searchRef}
            id="onboarding-search"
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all"
          />
        </div>

        {/* Stage tab strip */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'not_started', 'in_progress', 'awaiting_review', 'complete'] as Stage[]).map((s) => (
            <button
              key={s}
              onClick={() => switchStage(s)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer',
                stage === s
                  ? 'bg-primary border-primary text-on-primary'
                  : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-container-low',
              ].join(' ')}
            >
              {STAGE_LABEL[s]} {summary ? `(${s === 'all' ? summary.total : summary[s as keyof OnboardingSummary]})` : ''}
            </button>
          ))}
          <button
            onClick={() => setUrgentOnly((v) => !v)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer',
              urgentOnly
                ? 'bg-error border-error text-on-error'
                : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-container-low',
            ].join(' ')}
          >
            🚨 Urgent / Stalled
          </button>
        </div>
      </div>

      {loading && <Skeleton />}

      {!loading && error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <BulkReminderBar
          selectedIds={selectedIds}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Queue */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-10 text-center">
              {search ? (
                <>
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40">search_off</span>
                  <p className="text-sm text-on-surface-variant mt-2">No results for &ldquo;{search}&rdquo;.</p>
                </>
              ) : stage === 'all' ? (
                <>
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">people_outline</span>
                  <p className="text-base font-semibold text-on-surface mt-3">No staff in onboarding yet</p>
                  <p className="text-sm text-on-surface-variant mt-1">Start by inviting an applicant to begin the hiring process.</p>
                  <Link
                    href="/admin/applicants"
                    className="inline-flex items-center gap-2 mt-4 rounded-lg px-5 py-2.5 text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    Invite an Applicant
                  </Link>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40">inbox</span>
                  <p className="text-sm text-on-surface-variant mt-2">No staff in &ldquo;{STAGE_LABEL[stage]}&rdquo; stage.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select all row */}
              <div className="flex items-center gap-2 px-1">
                <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {allSelected ? 'Deselect all' : `Select all ${filtered.length}`}
                </label>
              </div>

              {filtered.map((row) => (
                <OnboardingCard
                  key={row.id}
                  row={row}
                  selected={selected.has(row.id)}
                  onToggle={toggleSelect}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 text-right">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== data.length && ` (filtered from ${data.length})`}
          </p>
        </>
      )}
    </div>
  )
}
