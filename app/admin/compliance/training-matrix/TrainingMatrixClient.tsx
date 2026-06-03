'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type {
  TrainingMatrixData,
  TrainingMatrixCell,
  MatrixStaff,
  MatrixCategory,
} from './page'

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TrainingMatrixCell['status'],
  { bg: string; text: string; icon: string; label: string }
> = {
  complete: { bg: 'bg-green-50',   text: 'text-green-700',  icon: 'check_circle',    label: 'Complete'  },
  expiring: { bg: 'bg-amber-50',   text: 'text-amber-700',  icon: 'schedule',        label: 'Expiring'  },
  expired:  { bg: 'bg-red-50',     text: 'text-red-700',    icon: 'cancel',          label: 'Expired'   },
  missing:  { bg: 'bg-surface-container', text: 'text-on-surface-variant', icon: 'remove_circle_outline', label: 'Missing' },
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function pctColor(pct: number): string {
  if (pct >= 90) return 'text-green-600'
  if (pct >= 70) return 'text-amber-600'
  return 'text-red-600'
}

// ── CSV export ────────────────────────────────────────────────────────────────

function buildCsv(
  staff:      MatrixStaff[],
  categories: MatrixCategory[],
  matrix:     Record<string, Record<string, TrainingMatrixCell>>,
): string {
  const header = [
    'Staff Name',
    'Job Role',
    'Training %',
    ...categories.map((c) => c.label),
  ].join(',')

  const rows = staff.map((s) => {
    const cells = categories.map((c) => {
      const cell = matrix[s.id]?.[c.key]
      return cell ? cell.status : 'missing'
    })
    return [
      `"${s.name}"`,
      `"${s.jobRole ?? ''}"`,
      s.trainingPct,
      ...cells.map((v) => `"${v}"`),
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `training-matrix-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Matrix cell ────────────────────────────────────────────────────────────────

function MatrixCell({ cell, categoryLabel }: { cell: TrainingMatrixCell | undefined; categoryLabel: string }) {
  const status = cell?.status ?? 'missing'
  const cfg    = STATUS_CONFIG[status]

  return (
    <td
      className={`px-2 py-1.5 text-center align-middle border-b border-outline-variant/30 ${cfg.bg}`}
      title={`${categoryLabel}: ${cfg.label}${cell?.expiryDate ? ` · Expires ${formatDate(cell.expiryDate)}` : ''}`}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className={`material-symbols-outlined text-[18px] ${cfg.text}`}>
          {cfg.icon}
        </span>
        {cell?.expiryDate && status !== 'complete' && (
          <span className={`text-[9px] font-medium tabular-nums leading-none ${cfg.text}`}>
            {formatDate(cell.expiryDate)}
          </span>
        )}
        {!cell?.expiryDate && status === 'complete' && (
          <span className="text-[9px] font-medium text-green-600 leading-none">Valid</span>
        )}
      </div>
    </td>
  )
}

// ── Mobile: staff card ────────────────────────────────────────────────────────

function MobileStaffCard({
  staff,
  categories,
  matrix,
}: {
  staff:      MatrixStaff
  categories: MatrixCategory[]
  matrix:     Record<string, Record<string, TrainingMatrixCell>>
}) {
  const [expanded, setExpanded] = useState(false)
  const staffMatrix = matrix[staff.id] ?? {}

  const counts = { complete: 0, expiring: 0, expired: 0, missing: 0 }
  for (const cat of categories) {
    const st = staffMatrix[cat.key]?.status ?? 'missing'
    counts[st]++
  }

  const initials = staff.name.split(' ').map((n) => n[0] ?? '').filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-container-low transition-colors"
        aria-expanded={expanded}
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">{staff.name}</p>
          {staff.jobRole && (
            <p className="text-xs text-on-surface-variant truncate">
              {staff.jobRole.replace(/_/g, ' ')}
            </p>
          )}
        </div>

        {/* Mini status pills */}
        <div className="flex items-center gap-1 flex-shrink-0 mr-1">
          {counts.complete > 0 && (
            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
              {counts.complete}✓
            </span>
          )}
          {counts.expiring > 0 && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
              {counts.expiring}!
            </span>
          )}
          {(counts.expired + counts.missing) > 0 && (
            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full">
              {counts.expired + counts.missing}✗
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className={`text-sm font-bold tabular-nums ${pctColor(staff.trainingPct)}`}>
            {staff.trainingPct}%
          </span>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {/* Expanded: training breakdown */}
      {expanded && (
        <div className="border-t border-outline-variant/50 divide-y divide-outline-variant/20">
          {categories.map((cat) => {
            const cell = staffMatrix[cat.key]
            const st   = cell?.status ?? 'missing'
            const cfg  = STATUS_CONFIG[st]
            return (
              <div key={cat.key} className={`flex items-center gap-3 px-4 py-2.5 ${cfg.bg}`}>
                <span className={`material-symbols-outlined text-[18px] shrink-0 ${cfg.text}`}>
                  {cfg.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-on-surface truncate">{cat.label}</p>
                  {!cat.isMandatory && (
                    <span className="text-[10px] text-on-surface-variant">Additional</span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</p>
                  {cell?.expiryDate && (
                    <p className="text-[10px] text-on-surface-variant tabular-nums">
                      {formatDate(cell.expiryDate)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          <div className="p-3 bg-surface-container-low">
            <Link
              href={`/admin/staff/${staff.id}`}
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              View Staff Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main client component ──────────────────────────────────────────────────────

export default function TrainingMatrixClient({ data }: { data: TrainingMatrixData }) {
  const { staff, categories, matrix, gapsPerCategory } = data
  const [search, setSearch] = useState('')

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staff
    const q = search.toLowerCase()
    return staff.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.jobRole ?? '').toLowerCase().includes(q)
    )
  }, [staff, search])

  // Summary counts across all categories for legend
  const totalGaps = categories.reduce((sum, cat) => sum + (gapsPerCategory[cat.key] ?? 0), 0)

  function handleExport() {
    const csv = buildCsv(filteredStaff, categories, matrix)
    downloadCsv(csv)
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (staff.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-6 py-16 text-center space-y-3">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant block">
          grid_view
        </span>
        <p className="text-base font-semibold text-primary">No active staff found</p>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
          Onboard your first care worker to start tracking mandatory training compliance.
        </p>
        <Link
          href="/admin/staff"
          className="inline-flex items-center gap-2 mt-2 bg-primary text-on-primary text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          Manage Staff
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            id="training-matrix-search"
            type="text"
            placeholder="Filter by staff name or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-secondary/40 focus:border-secondary outline-none transition-all"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-on-surface-variant">
          <span>
            <strong className="text-on-surface tabular-nums">{filteredStaff.length}</strong>{' '}
            {filteredStaff.length === 1 ? 'staff' : 'staff'}
          </span>
          <span>·</span>
          <span>
            <strong className="text-on-surface tabular-nums">{categories.length}</strong>{' '}
            categories
          </span>
          {totalGaps > 0 && (
            <>
              <span>·</span>
              <span className="text-red-600 font-medium">
                {totalGaps} gap{totalGaps !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        {/* Export */}
        <button
          id="training-matrix-export-csv"
          onClick={handleExport}
          className="flex items-center gap-2 bg-surface-container-highest text-primary px-4 py-2 text-sm font-medium rounded-lg hover:bg-surface-container-high transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">CSV</span>
        </button>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(STATUS_CONFIG) as Array<[TrainingMatrixCell['status'], typeof STATUS_CONFIG[TrainingMatrixCell['status']]]>).map(([status, cfg]) => (
          <div key={status} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
            <span className={`material-symbols-outlined text-[14px] ${cfg.text}`}>{cfg.icon}</span>
            {cfg.label}
          </div>
        ))}
      </div>

      {/* ── Desktop: matrix table ──────────────────────────────────────────── */}
      <div className="hidden lg:block bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm border-collapse">
            <thead>
              {/* Column headers */}
              <tr className="bg-surface-container">
                {/* Sticky staff name column */}
                <th
                  className="sticky left-0 z-10 bg-surface-container text-left px-4 py-3 font-semibold text-on-surface text-xs uppercase tracking-wider border-b border-r border-outline-variant whitespace-nowrap min-w-[200px]"
                >
                  Staff Member
                </th>
                {categories.map((cat) => (
                  <th
                    key={cat.key}
                    className="px-2 py-3 text-center font-semibold text-on-surface-variant text-[11px] uppercase tracking-wider border-b border-outline-variant/50 min-w-[64px] whitespace-nowrap"
                    title={cat.label}
                  >
                    <span className="block truncate max-w-[60px] mx-auto">{cat.abbr}</span>
                    {!cat.isMandatory && (
                      <span className="block text-[9px] text-on-surface-variant/60 font-normal normal-case">extra</span>
                    )}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-semibold text-on-surface-variant text-[11px] uppercase tracking-wider border-b border-l border-outline-variant whitespace-nowrap">
                  Training %
                </th>
              </tr>

              {/* Gap summary row */}
              <tr className="bg-surface-container-low">
                <td className="sticky left-0 z-10 bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant border-b border-r border-outline-variant">
                  Gaps (staff with missing/expired)
                </td>
                {categories.map((cat) => {
                  const gaps = gapsPerCategory[cat.key] ?? 0
                  return (
                    <td
                      key={cat.key}
                      className="px-2 py-2 text-center border-b border-outline-variant/30"
                    >
                      {gaps > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                          {gaps}
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[16px] text-green-600">check</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-2 border-b border-l border-outline-variant/30" />
              </tr>
            </thead>

            <tbody>
              {filteredStaff.length === 0 && (
                <tr>
                  <td
                    colSpan={categories.length + 2}
                    className="px-4 py-12 text-center text-sm text-on-surface-variant"
                  >
                    No staff match your search
                  </td>
                </tr>
              )}
              {filteredStaff.map((s, idx) => (
                <tr
                  key={s.id}
                  className={`group hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container/30'}`}
                >
                  {/* Sticky staff name */}
                  <td className={`sticky left-0 z-10 px-4 py-2 border-b border-r border-outline-variant/30 ${idx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container/30'} group-hover:bg-primary/5`}>
                    <Link
                      href={`/admin/staff/${s.id}`}
                      className="flex items-center gap-2 hover:text-secondary transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {s.name.split(' ').map((n) => n[0] ?? '').filter(Boolean).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-on-surface text-sm truncate max-w-[160px]">{s.name}</p>
                        {s.jobRole && (
                          <p className="text-[11px] text-on-surface-variant truncate max-w-[160px]">
                            {s.jobRole.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                    </Link>
                  </td>

                  {/* Training cells */}
                  {categories.map((cat) => (
                    <MatrixCell
                      key={cat.key}
                      cell={matrix[s.id]?.[cat.key]}
                      categoryLabel={cat.label}
                    />
                  ))}

                  {/* Training % */}
                  <td className="px-3 py-2 text-center border-b border-l border-outline-variant/30">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-sm font-bold tabular-nums ${pctColor(s.trainingPct)}`}>
                        {s.trainingPct}%
                      </span>
                      {/* Mini progress bar */}
                      <div className="w-10 h-1 bg-outline-variant/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.trainingPct >= 90 ? 'bg-green-500' : s.trainingPct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${s.trainingPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="px-4 py-3 border-t border-outline-variant/50 flex items-center justify-between">
          <p className="text-xs text-on-surface-variant">
            Showing {filteredStaff.length} of {staff.length} staff ·{' '}
            {categories.filter((c) => c.isMandatory).length} mandatory categories
          </p>
          <button
            onClick={handleExport}
            className="text-xs text-secondary hover:text-secondary/70 font-medium flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Mobile: staff cards ────────────────────────────────────────────── */}
      <div className="lg:hidden space-y-3">
        {/* Mobile summary */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          <div className="grid grid-cols-3 gap-3 text-center">
            {['complete', 'expiring', 'expired'].map((status) => {
              const cfg   = STATUS_CONFIG[status as TrainingMatrixCell['status']]
              const count = filteredStaff.reduce((sum, s) => {
                const staffMatrix = matrix[s.id] ?? {}
                return sum + Object.values(staffMatrix).filter((c) => c?.status === status).length
              }, 0)
              return (
                <div key={status} className={`rounded-lg p-2 ${cfg.bg}`}>
                  <p className={`text-lg font-bold tabular-nums ${cfg.text}`}>{count}</p>
                  <p className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {filteredStaff.length === 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-10 text-center">
            <p className="text-sm text-on-surface-variant">No staff match your search</p>
          </div>
        )}

        {filteredStaff.map((s) => (
          <MobileStaffCard
            key={s.id}
            staff={s}
            categories={categories}
            matrix={matrix}
          />
        ))}
      </div>
    </div>
  )
}
