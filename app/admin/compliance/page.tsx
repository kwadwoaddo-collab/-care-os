import Link from 'next/link'
import type { AlertItem, AlertsResponse, AlertsSummary } from '@/app/api/admin/compliance/alerts/route'
import type { ComplianceSummaryResponse } from '@/app/api/admin/compliance/summary/route'
import { adminFetch } from '@/lib/admin/serverFetch'
import { STATUS_BADGE_CLS, STATUS_LABEL } from '@/lib/compliance/status'
import ComplianceActions from './ComplianceActions'

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getAlerts(): Promise<AlertsResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/compliance/alerts`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch compliance alerts')
  return res.json() as Promise<AlertsResponse>
}

async function getItemSummary(): Promise<ComplianceSummaryResponse | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await adminFetch(`${baseUrl}/api/admin/compliance/summary`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json() as Promise<ComplianceSummaryResponse>
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  count,
  cls,
}: {
  label: string
  count: number
  cls:   string
}) {
  return (
    <div className={`rounded-lg border px-5 py-4 ${cls}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{count}</p>
    </div>
  )
}

const SEVERITY_CLS: Record<string, string> = {
  expired: 'bg-red-50    text-red-700    ring-red-600/20',
  warning: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  notice:  'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

const SEVERITY_LABEL: Record<string, string> = {
  expired: 'Expired',
  warning: 'Urgent',
  notice:  'Notice',
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_CLS[severity] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  )
}

function SectionBox({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{count}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function AlertRow({ alert }: { alert: AlertItem }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href={`/admin/staff/${alert.staffId}`}
          className="text-sm font-medium text-indigo-700 hover:underline truncate"
        >
          {alert.staffName}
        </Link>
        <span className="text-xs text-gray-500 truncate hidden sm:block">
          {alert.documentType.replace(/_/g, ' ')}
        </span>
        <span className="text-xs text-gray-400 hidden md:block">
          {alert.issue}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {alert.expiryDate ? formatDate(alert.expiryDate) : '—'}
        </span>
        <SeverityBadge severity={alert.severity} />
        <Link
          href={`/admin/staff/${alert.staffId}`}
          className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
        >
          View →
        </Link>
      </div>
    </div>
  )
}

function NonCompliantRow({ staffId, staffName }: { staffId: string; staffName: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
      <Link
        href={`/admin/staff/${staffId}`}
        className="text-sm font-medium text-indigo-700 hover:underline"
      >
        {staffName}
      </Link>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20">
          Non-compliant
        </span>
        <Link
          href={`/admin/staff/${staffId}`}
          className="text-xs text-indigo-600 hover:underline"
        >
          View →
        </Link>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CompliancePage() {
  let data: AlertsResponse
  let summary: AlertsSummary

  try {
    data    = await getAlerts()
    summary = data.summary
  } catch {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        Failed to load compliance alerts.
      </div>
    )
  }

  // Non-blocking — if summary fails the rest of the page still renders
  const itemSummary = await getItemSummary()

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Compliance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {summary.totalStaff} staff · {summary.activeStaff} active · avg {summary.averageCompliance}% compliance
          </p>
        </div>
        <ComplianceActions />
      </div>

      {/* ── Compliance item status (from compliance_items table) ───────────── */}
      {itemSummary && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Compliance item status
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(
              [
                ['compliant',     itemSummary.compliant,     'bg-green-50  border-green-200  text-green-900'],
                ['expiring_soon', itemSummary.expiring_soon, 'bg-yellow-50 border-yellow-200 text-yellow-900'],
                ['expired',       itemSummary.expired,       'bg-red-50    border-red-200    text-red-900'],
                ['missing',       itemSummary.missing,       itemSummary.missing > 0 ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-900'],
                ['rejected',      itemSummary.rejected,      itemSummary.rejected > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-white border-gray-200 text-gray-900'],
                ['in_review',     itemSummary.in_review,     'bg-blue-50   border-blue-200   text-blue-900'],
              ] as [string, number, string][]
            ).map(([key, count, cls]) => (
              <SummaryCard
                key={key}
                label={STATUS_LABEL[key as keyof typeof STATUS_LABEL] ?? key}
                count={count}
                cls={cls}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400">
            {itemSummary.total} total compliance items · based on compliance item records
          </p>
        </div>
      )}

      {/* ── Document alert summary (from uploaded documents) ──────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Document alerts
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard
            label="Expired documents"
            count={summary.expiredCount}
            cls={summary.expiredCount > 0
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-white border-gray-200 text-gray-900'}
          />
          <SummaryCard
            label="Expiring within 30 days"
            count={summary.expiringWithin30}
            cls={summary.expiringWithin30 > 0
              ? 'bg-yellow-50 border-yellow-200 text-yellow-900'
              : 'bg-white border-gray-200 text-gray-900'}
          />
          <SummaryCard
            label="Non-compliant staff"
            count={summary.nonCompliantCount}
            cls={summary.nonCompliantCount > 0
              ? 'bg-orange-50 border-orange-200 text-orange-900'
              : 'bg-white border-gray-200 text-gray-900'}
          />
        </div>
      </div>

      {/* All-clear message */}
      {summary.expiredCount === 0 && summary.expiringWithin30 === 0 && summary.nonCompliantCount === 0 && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
          All staff are compliant and no documents are expiring within 30 days.
        </div>
      )}

      {/* Expired */}
      {data.expired.length > 0 && (
        <SectionBox title="Expired documents" count={data.expired.length}>
          {data.expired.map((alert, i) => (
            <AlertRow key={`exp-${i}`} alert={alert} />
          ))}
        </SectionBox>
      )}

      {/* Expiring soon */}
      {data.expiringSoon.length > 0 && (
        <SectionBox title="Expiring soon" count={data.expiringSoon.length}>
          {data.expiringSoon.map((alert, i) => (
            <AlertRow key={`soon-${i}`} alert={alert} />
          ))}
        </SectionBox>
      )}

      {/* Non-compliant */}
      {data.nonCompliant.length > 0 && (
        <SectionBox title="Non-compliant staff" count={data.nonCompliant.length}>
          {data.nonCompliant.map((s) => (
            <NonCompliantRow key={s.staffId} staffId={s.staffId} staffName={s.staffName} />
          ))}
        </SectionBox>
      )}

    </div>
  )
}
