'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { PipelineRow, PipelineSummary } from './page'
import {
  READINESS_STAGE_LABEL,
  READINESS_STAGE_CLS,
  READINESS_STAGE_ICON,
  type WorkerReadinessStage,
} from '@/lib/onboarding/readiness'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  rows:        PipelineRow[]
  summary:     PipelineSummary
  riskForecast: { atRiskWorkers: number; expiringDocCount: number; byType: Record<string, number> }
}

type StageFilter = WorkerReadinessStage | 'all'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, colour = 'bg-indigo-500' }: { value: number; colour?: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${value}%` }} />
    </div>
  )
}

// ── Stage badge ───────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: WorkerReadinessStage }) {
  const cls  = READINESS_STAGE_CLS[stage]
  const icon = READINESS_STAGE_ICON[stage]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-0.5 ring-1 ring-inset ${cls}`}>
      <span className="material-symbols-outlined text-[10px]">{icon}</span>
      {READINESS_STAGE_LABEL[stage]}
    </span>
  )
}

// ── Score indicator ───────────────────────────────────────────────────────────

function ScoreChip({ score }: { score: number }) {
  const cls = score >= 80 ? 'text-green-700 bg-green-50' :
              score >= 60 ? 'text-amber-700 bg-amber-50' :
              score >= 40 ? 'text-orange-700 bg-orange-50' :
              'text-red-700 bg-red-50'
  return (
    <span className={`inline-block text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${cls}`}>
      {score}
    </span>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ summary, forecast }: { summary: PipelineSummary; forecast: Props['riskForecast'] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {[
        { label: 'Total staff',       value: summary.total,               icon: 'groups',         cls: 'text-gray-700' },
        { label: 'Deployment ready',  value: summary.deploymentReady,      icon: 'verified',       cls: 'text-green-700' },
        { label: 'Shadowing ready',   value: summary.byStage['ready_for_shadowing'] ?? 0, icon: 'supervised_user_circle', cls: 'text-teal-700' },
        { label: 'Blocked',           value: summary.blocked,              icon: 'block',          cls: 'text-red-700' },
        { label: 'Verification pending', value: summary.verificationPending, icon: 'hourglass_empty', cls: 'text-amber-700' },
        { label: 'Critical expiry',   value: summary.criticalExpiry,       icon: 'event_busy',     cls: 'text-orange-700' },
        { label: 'Avg score',         value: `${summary.avgScore}%`,       icon: 'trending_up',    cls: 'text-indigo-700' },
      ].map(({ label, value, icon, cls }) => (
        <div key={label} className="rounded-xl border border-gray-200 bg-surface-container-lowest px-3 py-2.5 flex items-start gap-2 shadow-sm">
          <span className={`material-symbols-outlined text-[18px] mt-0.5 ${cls}`}>{icon}</span>
          <div>
            <p className={`text-xl font-bold tabular-nums ${cls}`}>{value}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Stage kanban strip ────────────────────────────────────────────────────────

const STAGE_ORDER: WorkerReadinessStage[] = [
  'blocked',
  'onboarding_not_started',
  'documents_pending',
  'verification_pending',
  'compliance_pending',
  'ready_for_shadowing',
  'ready_for_deployment',
]

function StageKanban({ byStage, selected, onSelect }: {
  byStage:  Record<string, number>
  selected: StageFilter
  onSelect: (s: StageFilter) => void
}) {
  return (
    <div className="flex overflow-x-auto gap-2 pb-1">
      <button
        onClick={() => onSelect('all')}
        className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border transition-colors ${
          selected === 'all' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-surface-container-lowest border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="text-xs font-semibold">All</span>
        <span className="text-lg font-bold tabular-nums">{Object.values(byStage).reduce((s, v) => s + v, 0)}</span>
      </button>
      {STAGE_ORDER.map((stage) => {
        const count = byStage[stage] ?? 0
        const cls   = READINESS_STAGE_CLS[stage]
        const icon  = READINESS_STAGE_ICON[stage]
        const isSelected = selected === stage
        return (
          <button
            key={stage}
            onClick={() => onSelect(stage)}
            className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border transition-colors ${
              isSelected
                ? 'bg-gray-800 border-gray-700 text-white'
                : count === 0
                  ? 'bg-surface-container-lowest border-gray-100 text-gray-300 cursor-default'
                  : 'bg-surface-container-lowest border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            disabled={count === 0}
          >
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">{icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">
                {READINESS_STAGE_LABEL[stage]}
              </span>
            </div>
            <span className="text-lg font-bold tabular-nums">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Pipeline table row ────────────────────────────────────────────────────────

function PipelineRow({ row }: { row: PipelineRow }) {
  const stalledDays = daysSince(row.createdAt)
  const stalled     = stalledDays > 14 && row.stage !== 'ready_for_deployment' && row.stage !== 'blocked'

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
      row.stage === 'blocked' ? 'bg-red-50/30' : stalled ? 'bg-amber-50/20' : ''
    }`}>
      {/* Name + role */}
      <td className="px-4 py-3 min-w-0">
        <Link href={`/admin/staff/${row.id}`} className="group">
          <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
            {row.name}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">{row.jobRole ?? '—'}</p>
        </Link>
      </td>

      {/* Stage */}
      <td className="px-4 py-3 whitespace-nowrap">
        <StageBadge stage={row.stage} />
        {stalled && (
          <p className="text-[10px] text-amber-600 mt-0.5">
            <span className="material-symbols-outlined text-[10px]">schedule</span>
            {' '}Stalled {stalledDays}d
          </p>
        )}
      </td>

      {/* Score */}
      <td className="px-4 py-3 whitespace-nowrap">
        <ScoreChip score={row.score} />
      </td>

      {/* Progress bars */}
      <td className="px-4 py-3 min-w-[140px] hidden md:table-cell">
        <div className="space-y-1.5">
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Onboarding</span><span>{row.onboardingProgress}%</span>
            </div>
            <ProgressBar value={row.onboardingProgress}
              colour={row.onboardingProgress === 100 ? 'bg-green-500' : 'bg-indigo-500'} />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Verification</span><span>{row.verificationProgress}%</span>
            </div>
            <ProgressBar value={row.verificationProgress}
              colour={row.verificationProgress === 100 ? 'bg-green-500' : 'bg-blue-500'} />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
              <span>Compliance</span><span>{row.compliancePercentage}%</span>
            </div>
            <ProgressBar value={row.compliancePercentage}
              colour={row.compliancePercentage === 100 ? 'bg-green-500' : row.compliancePercentage < 50 ? 'bg-red-500' : 'bg-orange-500'} />
          </div>
        </div>
      </td>

      {/* Alerts */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="space-y-1">
          {row.pendingVerificationCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-amber-700">
              <span className="material-symbols-outlined text-[11px]">hourglass_empty</span>
              {row.pendingVerificationCount} pending verification
            </div>
          )}
          {row.rejectedCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-red-700">
              <span className="material-symbols-outlined text-[11px]">cancel</span>
              {row.rejectedCount} rejected
            </div>
          )}
          {row.criticalExpiryCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-orange-700">
              <span className="material-symbols-outlined text-[11px]">event_busy</span>
              {row.criticalExpiryCount} expiring soon
            </div>
          )}
        </div>
      </td>

      {/* Primary blocker */}
      <td className="px-4 py-3 hidden xl:table-cell max-w-[200px]">
        {row.blockers.length > 0 ? (
          <p className="text-[11px] text-gray-600 truncate" title={row.blockers[0]}>
            {row.blockers[0]}
          </p>
        ) : (
          <span className="text-[11px] text-gray-300">No blockers</span>
        )}
      </td>

      {/* Start date */}
      <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
        <span className="text-[11px] text-gray-500">{fmt(row.startDate ?? row.createdAt)}</span>
      </td>

      {/* Action */}
      <td className="px-4 py-3 whitespace-nowrap">
        <Link
          href={`/admin/staff/${row.id}?tab=documents`}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[11px]">open_in_new</span>
          View
        </Link>
      </td>
    </tr>
  )
}

// ── Risk forecast card ────────────────────────────────────────────────────────

function RiskForecastCard({ forecast }: { forecast: Props['riskForecast'] }) {
  if (forecast.atRiskWorkers === 0) return null
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
      <span className="material-symbols-outlined text-orange-600 text-[20px] mt-0.5">warning</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-orange-800">
          Compliance risk in next 30 days
        </p>
        <p className="text-xs text-orange-700 mt-0.5">
          {forecast.atRiskWorkers} staff member{forecast.atRiskWorkers !== 1 ? 's' : ''} have {forecast.expiringDocCount} compliance document{forecast.expiringDocCount !== 1 ? 's' : ''} expiring.
        </p>
        {Object.entries(forecast.byType).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(forecast.byType).slice(0, 5).map(([type, count]) => (
              <span key={type} className="text-[11px] font-medium text-orange-800 bg-orange-100 rounded-full px-2 py-0.5 border border-orange-200">
                {type.replace(/_/g, ' ')} ×{count}
              </span>
            ))}
          </div>
        )}
      </div>
      <a href="/admin/documents/verification"
        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-700 bg-surface-container-lowest hover:bg-orange-50 border border-orange-200 transition-colors">
        Review →
      </a>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPipelineClient({ rows, summary, riskForecast }: Props) {
  const [stageFilter, setStage] = useState<StageFilter>('all')
  const [search, setSearch]     = useState('')

  const filtered = useMemo(() => {
    let list = stageFilter === 'all' ? rows : rows.filter((r) => r.stage === stageFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((r) => r.name.toLowerCase().includes(s) || (r.jobRole ?? '').toLowerCase().includes(s))
    }
    return list.sort((a, b) => a.stage.localeCompare(b.stage) || b.score - a.score)
  }, [rows, stageFilter, search])

  return (
    <div className="space-y-5">
      <SummaryStrip summary={summary} forecast={riskForecast} />
      <RiskForecastCard forecast={riskForecast} />
      <StageKanban byStage={summary.byStage} selected={stageFilter} onSelect={setStage} />

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-gray-500 text-[18px]">list</span>
          <h2 className="text-sm font-semibold text-gray-700">
            Pipeline — {filtered.length} staff
          </h2>
          <div className="ml-auto relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[13px] text-gray-400">search</span>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="pl-7 pr-3 py-1 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[36px] text-gray-300">person_off</span>
            <p className="text-sm text-gray-400">No staff match your filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Onboarding pipeline">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Staff','Stage','Score','Progress','Alerts','Primary blocker','Start date',''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <PipelineRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
