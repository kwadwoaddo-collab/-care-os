'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { StaffComplianceRow, StaffComplianceResponse } from '@/app/api/admin/compliance/staff/route'
import { COMPLIANCE_STATE_CLS, COMPLIANCE_STATE_LABEL } from '@/lib/compliance/buildComplianceSnapshot'
import { BAND_CLS, getExpiryBandLabel, type ExpiryBand } from '@/lib/compliance/expiryBands'

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey =
  | '' | 'compliant' | 'warning' | 'non_compliant' | 'blocked'
  | 'expiring7d' | 'expiring14d' | 'expiring30d'
  | 'missing_dbs' | 'missing_rtw' | 'missing_training'

interface Summary {
  total: number; compliant: number; warning: number
  non_compliant: number; blocked: number
  expiring7d: number; expiring14d: number; expiring30d: number
}

// ── Filter chip definitions ───────────────────────────────────────────────────

const FILTER_CHIPS: { key: FilterKey; label: string; urgent?: boolean }[] = [
  { key: '',               label: 'All' },
  { key: 'compliant',      label: 'Compliant' },
  { key: 'warning',        label: 'Warning' },
  { key: 'non_compliant',  label: 'Non-compliant', urgent: true },
  { key: 'blocked',        label: 'Blocked',        urgent: true },
  { key: 'expiring7d',     label: 'Expiring 7d',    urgent: true },
  { key: 'expiring14d',    label: 'Expiring 14d' },
  { key: 'expiring30d',    label: 'Expiring 30d' },
  { key: 'missing_dbs',    label: 'Missing DBS',    urgent: true },
  { key: 'missing_rtw',    label: 'Missing RTW',    urgent: true },
  { key: 'missing_training', label: 'Missing Training', urgent: true },
]

// ── State badge ───────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: string }) {
  const cls = COMPLIANCE_STATE_CLS[state as keyof typeof COMPLIANCE_STATE_CLS]
    ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  const label = COMPLIANCE_STATE_LABEL[state as keyof typeof COMPLIANCE_STATE_LABEL] ?? state
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  )
}

// ── Expiry pill ───────────────────────────────────────────────────────────────

function ExpiryPill({ band, label }: { band: ExpiryBand; label: string }) {
  const cls = BAND_CLS[band] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  )
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({ label, count, cls, onClick }: {
  label:   string
  count:   number
  cls:     string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-left w-full hover:shadow-sm transition-shadow ${cls}`}
    >
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-3xl font-semibold tabular-nums mt-1">{count}</p>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComplianceDashboardClient() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentFilter = (searchParams.get('filter') ?? '') as FilterKey
  const currentSearch = searchParams.get('search') ?? ''

  const [data,      setData]     = useState<StaffComplianceRow[]>([])
  const [summary,   setSummary]  = useState<Summary | null>(null)
  const [loading,   setLoading]  = useState(true)
  const [selected,  setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy,  setBulkBusy] = useState(false)
  const [bulkMsg,   setBulkMsg]  = useState<string | null>(null)
  const [search,    setSearch]   = useState(currentSearch)

  // ── Fetch staff compliance rows ─────────────────────────────────────────────
  const fetchRows = useCallback((filter: string, q: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter) params.set('filter', filter)
    if (q)      params.set('search', q)
    params.set('pageSize', '100')

    fetch(`/api/admin/compliance/staff?${params}`)
      .then((r) => r.json() as Promise<StaffComplianceResponse>)
      .then((d) => {
        setData(d.data ?? [])
        setSummary(d.summary as Summary)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchRows(currentFilter, currentSearch)
  }, [currentFilter, currentSearch, fetchRows])

  // ── URL-based filter & search update ───────────────────────────────────────
  function setFilter(key: FilterKey) {
    const p = new URLSearchParams(searchParams.toString())
    if (key) p.set('filter', key); else p.delete('filter')
    p.delete('search')
    setSearch('')
    startTransition(() => router.replace(`${pathname}?${p.toString()}`))
  }

  function submitSearch() {
    const p = new URLSearchParams(searchParams.toString())
    if (search) p.set('search', search); else p.delete('search')
    p.delete('filter')
    startTransition(() => router.replace(`${pathname}?${p.toString()}`))
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  function toggleAll() {
    if (selected.size === data.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.map((r) => r.staffId)))
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Bulk send reminder ─────────────────────────────────────────────────────
  async function bulkSendReminder() {
    setBulkBusy(true)
    setBulkMsg(null)
    try {
      const res = await fetch('/api/admin/compliance/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'send_reminder', staffIds: [...selected] }),
      })
      const j = await res.json() as { sent: number; skipped: number }
      setBulkMsg(`✅ Reminders sent to ${j.sent} staff · ${j.skipped} skipped`)
    } catch {
      setBulkMsg('Failed to send reminders. Please try again.')
    } finally {
      setBulkBusy(false)
    }
  }

  // ── Export CSV (selected or all) ────────────────────────────────────────────
  function exportCsv() {
    const ids = selected.size > 0 ? [...selected].join(',') : ''
    const url = `/api/admin/compliance/export${ids ? `?staffIds=${ids}` : ''}`
    window.open(url, '_blank')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Summary stat cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard
            label="Compliant"
            count={summary.compliant}
            cls="bg-green-50 border-green-200 text-green-900"
            onClick={() => setFilter('compliant')}
          />
          <StatCard
            label="Warning"
            count={summary.warning}
            cls={summary.warning > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-900' : 'bg-white border-gray-200 text-primary'}
            onClick={() => setFilter('warning')}
          />
          <StatCard
            label="Non-compliant"
            count={summary.non_compliant}
            cls={summary.non_compliant > 0 ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-white border-gray-200 text-primary'}
            onClick={() => setFilter('non_compliant')}
          />
          <StatCard
            label="Blocked"
            count={summary.blocked}
            cls={summary.blocked > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-white border-gray-200 text-primary'}
            onClick={() => setFilter('blocked')}
          />
          <StatCard
            label="Expiring 7 days"
            count={summary.expiring7d}
            cls={summary.expiring7d > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-white border-gray-200 text-primary'}
            onClick={() => setFilter('expiring7d')}
          />
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => {
          const active = currentFilter === chip.key
          return (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                active
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : chip.urgent
                  ? 'bg-white border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-600'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            id="compliance-search"
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={submitSearch}
            className="rounded-md bg-indigo-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-on-surface-variant">{selected.size} selected</span>
              <button
                id="bulk-send-reminder"
                onClick={bulkSendReminder}
                disabled={bulkBusy}
                className="rounded-md bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {bulkBusy ? 'Sending…' : 'Send Reminder'}
              </button>
            </>
          )}
          <button
            id="export-csv"
            onClick={exportCsv}
            className="rounded-md bg-white border border-gray-300 text-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            {selected.size > 0 ? `Export ${selected.size} selected` : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Bulk action feedback */}
      {bulkMsg && (
        <div className={`rounded-md px-4 py-2.5 text-sm border ${bulkMsg.startsWith('✅') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {bulkMsg}
        </div>
      )}

      {/* Staff compliance table */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            {loading ? 'Loading…' : `${data.length} staff member${data.length !== 1 ? 's' : ''}`}
            {currentFilter && <span className="ml-2 font-normal text-gray-400">· filtered by {currentFilter.replace(/_/g, ' ')}</span>}
          </h2>
        </div>

        {loading && (
          <div className="px-4 py-10 text-center text-sm text-gray-400 animate-pulse">
            Loading compliance data…
          </div>
        )}

        {!loading && data.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            No staff members match this filter.
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead>
                <tr className="text-xs text-on-surface-variant font-medium bg-gray-50/50">
                  <th className="px-4 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={selected.size === data.length && data.length > 0}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left hidden md:table-cell">Role</th>
                  <th className="px-4 py-2 text-left">State</th>
                  <th className="px-4 py-2 text-left hidden sm:table-cell">Score</th>
                  <th className="px-4 py-2 text-left hidden lg:table-cell">Issues</th>
                  <th className="px-4 py-2 text-left hidden lg:table-cell">Expiring</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((row) => (
                  <tr
                    key={row.staffId}
                    className={`hover:bg-gray-50 transition-colors ${
                      row.complianceState === 'blocked'       ? 'bg-red-50/30' :
                      row.complianceState === 'non_compliant' ? 'bg-orange-50/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.staffName}`}
                        checked={selected.has(row.staffId)}
                        onChange={() => toggleRow(row.staffId)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/staff/${row.staffId}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {row.staffName}
                      </Link>
                      {row.status !== 'active' && (
                        <span className="ml-2 text-xs text-gray-400">{row.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs hidden md:table-cell">
                      {row.jobRole?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={row.complianceState} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.percentage >= 100 ? 'bg-green-500' :
                              row.percentage >= 70  ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${row.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-gray-600">{row.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {row.missingDocs.length === 0 && row.missingTraining.length === 0 ? (
                        <span className="text-xs text-gray-400">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.missingDocs.slice(0, 2).map((d) => (
                            <span key={d} className="text-xs bg-red-50 text-red-700 rounded px-1.5 py-0.5">
                              {d.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {row.missingTraining.slice(0, 2).map((t) => (
                            <span key={t} className="text-xs bg-orange-50 text-orange-700 rounded px-1.5 py-0.5">
                              {t.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {(row.missingDocs.length + row.missingTraining.length) > 4 && (
                            <span className="text-xs text-gray-400">+{(row.missingDocs.length + row.missingTraining.length) - 4} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {row.expiringSoon.length === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.expiringSoon.slice(0, 2).map((e, i) => (
                            <ExpiryPill key={i} band={e.band} label={e.type.replace(/_/g, ' ')} />
                          ))}
                          {row.expiringSoon.length > 2 && (
                            <span className="text-xs text-gray-400">+{row.expiringSoon.length - 2}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={async () => {
                            setBulkBusy(true)
                            setBulkMsg(null)
                            try {
                              const res = await fetch('/api/admin/compliance/reminders/worker', {
                                method:  'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body:    JSON.stringify({ staffIds: [row.staffId] }),
                              })
                              const j = await res.json() as { sent: number; results?: Array<{ skipped: boolean; reason?: string }> }
                              const skipped = j.results?.[0]?.skipped
                              const reason  = j.results?.[0]?.reason
                              setBulkMsg(skipped
                                ? `Skipped: ${reason ?? 'already compliant'}`
                                : `✅ Reminder sent to ${row.staffName}`
                              )
                            } catch {
                              setBulkMsg('Failed to send reminder')
                            } finally {
                              setBulkBusy(false)
                            }
                          }}
                          disabled={bulkBusy}
                          className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                        >
                          Remind
                        </button>
                        <Link
                          href={`/admin/staff/${row.staffId}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
