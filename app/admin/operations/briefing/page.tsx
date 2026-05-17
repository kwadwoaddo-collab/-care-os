import Link            from 'next/link'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import AccessDenied     from '@/components/admin/AccessDenied'
import { adminFetch }   from '@/lib/admin/serverFetch'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import type { DailyBriefing, BriefingSection } from '@/app/api/admin/operations/briefing/route'

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getBriefing(): Promise<DailyBriefing | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res  = await adminFetch(`${base}/api/admin/operations/briefing`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json() as Promise<DailyBriefing>
}

// ── Sub-components ────────────────────────────────────────────────────────────

const HEADLINE_CLS: Record<string, string> = {
  clear:    'bg-green-50 border-green-200 text-green-800',
  warning:  'bg-amber-50 border-amber-200 text-amber-800',
  critical: 'bg-red-50   border-red-200   text-red-800',
}

const HEADLINE_ICON: Record<string, string> = {
  clear:    '✅',
  warning:  '⚠️',
  critical: '🔴',
}

const SECTION_STATUS_CLS: Record<string, string> = {
  clear:    'border-green-200  bg-green-50/30',
  warning:  'border-amber-200  bg-amber-50/20',
  critical: 'border-red-200    bg-red-50/20',
}

const SECTION_BADGE: Record<string, string> = {
  clear:    'bg-green-100 text-green-700',
  warning:  'bg-amber-100 text-amber-700',
  critical: 'bg-red-100   text-red-700',
}

const ITEM_PRIORITY_CLS: Record<string, string> = {
  critical: 'text-red-600 font-bold',
  urgent:   'text-orange-600 font-semibold',
  warning:  'text-amber-700',
  ok:       'text-green-600',
}

const ITEM_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  urgent:   'bg-orange-500',
  warning:  'bg-yellow-400',
  ok:       'bg-green-400',
}

function BriefingSectionCard({ section }: { section: BriefingSection }) {
  return (
    <div className={`rounded-xl border shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5 ${SECTION_STATUS_CLS[section.status] ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{section.heading}</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${SECTION_BADGE[section.status] ?? ''}`}>
          {section.status}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{section.summary}</p>
      {section.items.length > 0 && (
        <div className="space-y-2">
          {section.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${ITEM_DOT[item.priority] ?? 'bg-gray-300'}`} />
              <div className="flex-1">
                {item.url ? (
                  <Link href={item.url} className="font-medium text-indigo-700 hover:underline">{item.label}</Link>
                ) : (
                  <span className="font-medium text-gray-700">{item.label}</span>
                )}
                <span className={`ml-2 ${ITEM_PRIORITY_CLS[item.priority] ?? 'text-gray-500'}`}>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BriefingPage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'incidents:read')) return <AccessDenied />

  const briefing = await getBriefing()

  if (!briefing) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-10 text-center">
        <p className="text-sm font-medium text-primary">Failed to generate briefing</p>
        <p className="text-xs text-gray-400 mt-1">Please refresh the page.</p>
      </div>
    )
  }

  const dateLabel = new Date(briefing.date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-5">
      <MobilePageHeader title="Daily Briefing" subtitle={dateLabel} />

      <div className="hidden lg:block">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin/operations" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
            ← Operations
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-primary">Daily Operational Briefing</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">{dateLabel}</p>
          </div>
        </div>
      </div>

      {/* Risk headline */}
      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${HEADLINE_CLS[briefing.risk_headline]}`}>
        <span className="text-xl">{HEADLINE_ICON[briefing.risk_headline]}</span>
        <div>
          <p className="text-sm font-bold">
            {briefing.risk_headline === 'critical' && 'Critical issues require immediate attention today'}
            {briefing.risk_headline === 'warning'  && 'Operational warnings require review today'}
            {briefing.risk_headline === 'clear'    && 'Operations are clear — no critical issues today'}
          </p>
          <p className="text-xs mt-0.5 opacity-80">
            {briefing.open_queue_count} open queue item{briefing.open_queue_count !== 1 ? 's' : ''}
            {briefing.overdue_actions > 0 && ` · ${briefing.overdue_actions} overdue action${briefing.overdue_actions !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/admin/operations/queue"
          className="ml-auto text-xs font-semibold underline underline-offset-2"
        >
          View queue
        </Link>
      </div>

      {/* Briefing sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {briefing.sections.map((section) => (
          <BriefingSectionCard key={section.heading} section={section} />
        ))}
      </div>

      <p className="text-[10px] text-gray-400 text-right">
        Generated at {new Date(briefing.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
