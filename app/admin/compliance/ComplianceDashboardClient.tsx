'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { StaffComplianceRow, StaffComplianceResponse } from '@/app/api/admin/compliance/staff/route'
import { COMPLIANCE_STATE_CLS, COMPLIANCE_STATE_LABEL } from '@/lib/compliance/buildComplianceSnapshot'
import { BAND_CLS, type ExpiryBand } from '@/lib/compliance/expiryBands'
import { TerminationModal, type TerminationData } from '@/components/admin/TerminationModal'
import { hasRole } from '@/lib/rbac/roles'

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

// ── Summary stat card ─────────────────────────────────────────────────────────

function TriageCard({ label, count, description, cls, icon, iconCls, onClick }: {
  label:       string
  count:       number
  description: string
  cls:         string
  icon:        string
  iconCls:     string
  onClick:     () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-surface-container-lowest border-l-4 p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col items-start text-left w-full hover:shadow-md transition-shadow ${cls}`}
    >
      <div className="flex justify-between items-start w-full">
        <div>
          <p className="text-label-md font-label-md uppercase tracking-wider">{label}</p>
          <h2 className="text-display-lg font-display-lg text-primary">{count}</h2>
        </div>
        <span className={`material-symbols-outlined text-[32px] opacity-20 ${iconCls}`}>{icon}</span>
      </div>
      <p className="text-body-md text-on-surface-variant mt-2">{description}</p>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComplianceDashboardClient({ userRole }: { userRole?: string }) {
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [staffToTerminate, setStaffToTerminate] = useState<StaffComplianceRow | null>(null)

  useEffect(() => {
    const clickHandler = () => setOpenMenuId(null)
    document.addEventListener('click', clickHandler)
    return () => document.removeEventListener('click', clickHandler)
  }, [])

  async function doStatusChange(staffId: string, newStatus: string, terminationData?: TerminationData) {
    setBulkBusy(true)
    setBulkMsg(null)
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus, force: false, ...terminationData }),
      })
      if (!res.ok) throw new Error()
      setBulkMsg(`✅ Worker status updated`)
      fetchRows(currentFilter, currentSearch)
    } catch {
      setBulkMsg(`Failed to update worker status`)
    } finally {
      setBulkBusy(false)
      setStaffToTerminate(null)
    }
  }

  async function remindWorker(row: StaffComplianceRow) {
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
  }

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TriageCard
            label="Non-compliant"
            count={summary.non_compliant + summary.blocked}
            description="Requires immediate attention"
            cls="border-error"
            icon="error"
            iconCls="text-error"
            onClick={() => setFilter('non_compliant')}
          />
          <TriageCard
            label="Expiring Soon"
            count={summary.expiring7d + summary.expiring14d + summary.expiring30d}
            description="Expires within 30 days"
            cls="border-tertiary-fixed-dim"
            icon="warning"
            iconCls="text-tertiary-fixed-dim"
            onClick={() => setFilter('warning')}
          />
          <TriageCard
            label="Fully Compliant"
            count={summary.compliant}
            description="All credentials verified"
            cls="border-secondary"
            icon="check_circle"
            iconCls="text-secondary"
            onClick={() => setFilter('compliant')}
          />
        </div>
      )}

      {/* Controls Container */}
      <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant space-y-4">
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
                    ? 'bg-primary border-primary text-on-primary'
                    : chip.urgent
                    ? 'bg-white border-outline-variant text-on-surface hover:border-error hover:text-error'
                    : 'bg-white border-outline-variant text-on-surface hover:bg-surface-container-low',
                ].join(' ')}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Search + bulk actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              id="compliance-search"
              type="text"
              placeholder="Search compliance status, staff, or roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              className="w-full bg-white border border-outline-variant rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all"
            />
            <button
              onClick={submitSearch}
              className="rounded-lg bg-primary text-on-primary px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <>
                <span className="text-xs text-on-surface-variant font-medium">{selected.size} selected</span>
                <button
                  id="bulk-send-reminder"
                  onClick={bulkSendReminder}
                  disabled={bulkBusy}
                  className="rounded-lg bg-secondary-container/10 text-secondary border border-secondary-container/20 px-4 py-2 text-sm font-medium hover:bg-secondary-container/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">mail</span>
                  {bulkBusy ? 'Sending…' : 'Remind'}
                </button>
              </>
            )}
            <button
              id="export-csv"
              onClick={exportCsv}
              className="rounded-lg bg-surface-container-highest text-primary px-4 py-2 text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {selected.size > 0 ? `Export ${selected.size}` : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action feedback */}
      {bulkMsg && (
        <div className={`rounded-md px-4 py-2.5 text-sm border ${bulkMsg.startsWith('✅') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {bulkMsg}
        </div>
      )}

      {/* Staff compliance grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-primary">
              {loading ? 'Loading…' : `${data.length} staff member${data.length !== 1 ? 's' : ''}`}
            </h2>
            {currentFilter && <span className="text-sm font-normal text-on-surface-variant">· filtered by {currentFilter.replace(/_/g, ' ')}</span>}
          </div>
          {/* Select all toggle */}
          {data.length > 0 && !loading && (
            <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={selected.size === data.length && data.length > 0}
                onChange={toggleAll}
                className="rounded border-outline-variant text-primary focus:ring-primary"
              />
              Select All
            </label>
          )}
        </div>

        {loading && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-10 text-center text-sm text-on-surface-variant animate-pulse">
            Loading compliance data…
          </div>
        )}

        {!loading && data.length === 0 && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-10 text-center text-sm text-on-surface-variant">
            No staff members match this filter.
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.map((row) => {
              const avatarInitials = row.staffName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
              const ringColor = row.complianceState === 'blocked' ? 'border-error' : row.complianceState === 'non_compliant' ? 'border-error' : row.complianceState === 'warning' ? 'border-tertiary-fixed-dim' : 'border-secondary'
              
              return (
                <div key={row.staffId} className="bg-surface-container-lowest border border-outline-variant p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col h-full relative group">
                  {/* Top Right Actions */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.staffName}`}
                      checked={selected.has(row.staffId)}
                      onChange={() => toggleRow(row.staffId)}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === row.staffId ? null : row.staffId); }}
                        className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-md hover:bg-surface-container flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>
                      {openMenuId === row.staffId && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-outline-variant shadow-lg rounded-xl overflow-hidden z-10 py-1" onClick={e => e.stopPropagation()}>
                          <Link href={`/admin/staff/${row.staffId}`} className="block px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low w-full text-left">View Profile</Link>
                          <button onClick={() => remindWorker(row)} className="block px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low w-full text-left">Send Reminder</button>
                          {hasRole(userRole || 'care_worker', 'coordinator') && (
                            <button onClick={() => { setOpenMenuId(null); doStatusChange(row.staffId, 'suspended'); }} className="block px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 w-full text-left">Suspend Worker</button>
                          )}
                          {hasRole(userRole || 'care_worker', 'company_admin') && (
                            <button onClick={() => { setOpenMenuId(null); setStaffToTerminate(row); }} className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">Archive Worker</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4 pr-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-surface-container-high text-primary font-bold border-2 ${ringColor}`}>
                      {avatarInitials}
                    </div>
                    <div>
                      <h3 className="font-headline-md text-headline-md text-primary truncate max-w-[150px]">{row.staffName}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-block px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-[10px] font-bold uppercase tracking-tighter truncate max-w-[150px]">
                          {row.jobRole?.replace(/_/g, ' ') ?? 'Staff'}
                        </span>
                        {row.status === 'active' && <span className="inline-block px-2 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-tighter">Active</span>}
                        {row.status === 'suspended' && <span className="inline-block px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-[10px] font-bold uppercase tracking-tighter">Suspended</span>}
                        {row.status === 'terminated' && <span className="inline-block px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-tighter">Archived</span>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-label-md font-label-md text-on-surface-variant flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">health_and_safety</span>
                        Compliance Health
                      </p>
                      <span className="text-xs font-bold tabular-nums text-primary">{row.percentage}%</span>
                    </div>

                    <div className="space-y-2">
                      {row.missingDocs.length === 0 && row.missingTraining.length === 0 && row.expiringSoon.length === 0 ? (
                        <div className="flex justify-between items-center bg-surface-container-low p-2 rounded border border-outline-variant/30">
                          <span className="text-body-md text-primary">All Credentials</span>
                          <span className="text-label-md text-secondary">Valid</span>
                        </div>
                      ) : (
                        <>
                          {/* Display up to 3 priority items */}
                          {[...row.missingDocs.map(d => ({ name: d, state: 'missing', label: 'MISSING' })),
                            ...row.missingTraining.map(t => ({ name: t, state: 'missing', label: 'MISSING' })),
                            ...row.expiringSoon.map(e => ({ name: e.type, state: 'expiring', label: 'EXPIRING' }))]
                            .slice(0, 3)
                            .map((item, idx) => (
                              <div key={idx} className={`flex justify-between items-center p-2 rounded border ${
                                item.state === 'missing' ? 'bg-error/5 border-error/20' : 'bg-tertiary-fixed/10 border-tertiary-fixed-dim/30'
                              }`}>
                                <span className="text-body-md text-primary truncate pr-2" title={item.name.replace(/_/g, ' ')}>{item.name.replace(/_/g, ' ')}</span>
                                <span className={`text-[10px] font-bold ${item.state === 'missing' ? 'text-error' : 'text-tertiary'}`}>{item.label}</span>
                              </div>
                            ))}
                            
                          {(row.missingDocs.length + row.missingTraining.length + row.expiringSoon.length) > 3 && (
                            <div className="text-center text-xs text-on-surface-variant mt-1 font-medium">
                              +{(row.missingDocs.length + row.missingTraining.length + row.expiringSoon.length) - 3} more issues
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>


                </div>
              )
            })}
          </div>
        )}
      </div>

      {staffToTerminate && (
        <TerminationModal
          onConfirm={(data) => doStatusChange(staffToTerminate.staffId, 'terminated', data)}
          onCancel={() => setStaffToTerminate(null)}
          isLoading={bulkBusy}
        />
      )}
    </div>
  )
}
