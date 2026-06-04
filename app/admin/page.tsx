import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import type { AlertsResponse, AlertItem } from '@/app/api/admin/compliance/alerts/route'
import type { OnboardingResponse } from '@/app/api/admin/onboarding/route'
import { adminFetch } from '@/lib/admin/serverFetch'
import AdminDashboardDesktop from '@/components/admin/AdminDashboardDesktop'
import { fmt, staffName, settle } from '@/lib/utils/formatters'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Incident {
  id:              string
  incident_type:   string
  severity:        string
  status:          string
  occurred_at:     string | null
  created_at:      string
  description:     string
  clients:         { first_name: string; last_name: string } | null
  staff_profiles:  { first_name: string | null; last_name: string | null } | null
}

const INCIDENT_SEVERITY_CLS: Record<string, string> = {
  low:      'bg-gray-50    text-gray-600',
  medium:   'bg-yellow-50  text-yellow-700',
  high:     'bg-orange-50  text-orange-700',
  critical: 'bg-red-50     text-red-700',
}

const INCIDENT_STATUS_CLS: Record<string, string> = {
  open:          'bg-red-50     text-red-700',
  investigating: 'bg-blue-50    text-blue-700',
  resolved:      'bg-green-50   text-green-700',
  closed:        'bg-gray-50    text-on-surface-variant',
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function SectionBox({ title, children, action }: {
  title:    string
  children: React.ReactNode
  action?:  React.ReactNode
}) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-6 py-5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-on-surface tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="px-6 pb-6">
        {children}
      </div>
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, count, sub, href, urgent }: {
  label:  string
  count:  number
  sub:    string
  href:   string
  urgent?: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        'rounded-lg border px-4 py-3 block hover:shadow-sm transition-shadow',
        urgent && count > 0
          ? 'bg-red-50 border-red-200 text-red-900'
          : 'bg-surface-container-lowest border-gray-200 text-primary',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${urgent && count > 0 ? 'text-red-700' : ''}`}>
        {count}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let companyName = 'Care OS'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('companies(name)')
      .eq('id', user.id)
      .maybeSingle()
    companyName = (profile?.companies as any)?.name ?? 'Care OS'
  }

  const today = new Date().toISOString().slice(0, 10)
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // All queries fire in parallel — no waterfalls
  const results = await Promise.allSettled([
    // [0] Active staff count
    adminClient
      .from('staff_profiles')
      .select('status'),

    // [1] Open (unassigned) shift count — for ops banner only
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .is('assigned_staff_id', null)
      .in('status', ['scheduled', 'confirmed']),

    // [2] HR incomplete: staff not finished onboarding
    adminClient
      .from('staff_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('onboarding_completed', false)
      .not('status', 'eq', 'terminated'),

    // [3] Pending applications (applied or shortlisted, not deleted)
    adminClient
      .from('applicants')
      .select('id', { count: 'exact', head: true })
      .in('status', ['applied', 'shortlisted'])
      .is('deleted_at', null),

    // [4] Documents expiring within 7 days
    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .not('expiry_date', 'is', null)
      .gte('expiry_date', today)
      .lte('expiry_date', in7days),

    // [5] Recent open incidents
    adminClient
      .from('incidents')
      .select(`
        id, incident_type, severity, status, occurred_at, created_at, description,
        clients!client_id      ( first_name, last_name ),
        staff_profiles!staff_profile_id ( first_name, last_name )
      `)
      .in('status', ['open', 'investigating'])
      .order('created_at', { ascending: false })
      .limit(5),

    // [6] Compliance alerts API
    adminFetch(`${BASE}/api/admin/compliance/alerts`, { cache: 'no-store' }),

    // [7] Onboarding summary
    adminFetch(`${BASE}/api/admin/onboarding`, { cache: 'no-store' }),
  ])

  const getValue = <T,>(idx: number, fallback: T): T =>
    results[idx].status === 'fulfilled' ? (results[idx] as PromiseFulfilledResult<any>).value : fallback

  const staffStatusResult       = getValue(0, { data: [] })
  const openShiftsCountResult   = getValue(1, { count: 0 })
  const hrIncompleteResult      = getValue(2, { count: 0 })
  const pendingAppResult        = getValue(3, { count: 0 })
  const expiring7dResult        = getValue(4, { count: 0 })
  const incidentsResult         = getValue(5, { data: [] })
  const complianceRes           = getValue(6, { ok: false, json: async () => null }) as any
  const onboardingRes           = getValue(7, { ok: false, json: async () => null }) as any

  // Parse HTTP responses
  const compliance: AlertsResponse | null = complianceRes.ok
    ? (await complianceRes.json() as AlertsResponse)
    : null

  const onboarding: OnboardingResponse | null = onboardingRes.ok
    ? (await onboardingRes.json() as OnboardingResponse)
    : null

  // Derive summary numbers
  const allStaff          = staffStatusResult.data ?? []
  const activeStaff       = allStaff.filter((s: any) => s.status === 'active').length
  const openShifts        = openShiftsCountResult.count    ?? 0
  const hrIncomplete      = hrIncompleteResult.count       ?? 0
  const pendingApplications = pendingAppResult.count       ?? 0
  const expiring7d        = expiring7dResult.count         ?? 0
  const nonCompliant      = compliance?.summary.nonCompliantCount ?? 0
  const incidents         = (incidentsResult.data ?? []) as unknown as Incident[]

  const topAlerts: AlertItem[] = [
    ...(compliance?.expired      ?? []),
    ...(compliance?.expiringSoon ?? []),
  ].slice(0, 5)

  // Onboarding stats (from pilot analytics — reuse for onboarding pipeline card)
  const results2 = await Promise.allSettled([
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).not('status', 'eq', 'terminated'),
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true),
  ])

  const getValue2 = <T,>(idx: number, fallback: T): T =>
    results2[idx].status === 'fulfilled' ? (results2[idx] as PromiseFulfilledResult<any>).value : fallback

  const pilotTotalStaff = getValue2(0, { count: 0 }).count ?? 0
  const pilotOnboarded  = getValue2(1, { count: 0 }).count ?? 0
  const onboardingPct   = pilotTotalStaff > 0 ? Math.round((pilotOnboarded / pilotTotalStaff) * 100) : 0

  return (
    <div className="space-y-6">

      {/* ── Mobile view (lg:hidden) ─────────────────────────────────────────── */}
      <div className="lg:hidden space-y-6">

        {/* Header */}
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">{companyName}</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">{today}</p>
        </div>

        {/* 2×2 metric grid */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Pending Applications"
            count={pendingApplications}
            sub="Awaiting review"
            href="/admin/applicants"
            urgent={pendingApplications > 0}
          />
          <SummaryCard
            label="Onboarding in Progress"
            count={hrIncomplete}
            sub="Not yet complete"
            href="/admin/onboarding"
            urgent={hrIncomplete > 0}
          />
          <SummaryCard
            label="Compliance Gaps"
            count={nonCompliant + expiring7d}
            sub="Expiring soon"
            href="/admin/compliance"
            urgent={(nonCompliant + expiring7d) > 0}
          />
          <SummaryCard
            label="Active Staff"
            count={activeStaff}
            sub="View all profiles"
            href="/admin/staff"
          />
        </div>

        {/* Compliance Alerts */}
        {topAlerts.length > 0 && (
          <SectionBox
            title="Compliance Alerts"
            action={
              <Link href="/admin/compliance" className="text-xs text-secondary font-medium hover:underline">
                View all →
              </Link>
            }
          >
            <div className="space-y-2 -mx-0">
              {topAlerts.slice(0, 3).map((alert, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 py-2 border-b border-outline-variant/20 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-on-surface truncate">{alert.staffName}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {alert.documentType.replace(/_/g, ' ')}
                      {alert.expiryDate ? ` · ${fmt(alert.expiryDate)}` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                    alert.severity === 'expired' ? 'bg-red-100 text-red-700' :
                    alert.severity === 'warning' ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          </SectionBox>
        )}

        {/* Recent Incidents */}
        <SectionBox
          title="Recent Incidents"
          action={
            <Link href="/admin/incidents" className="text-xs text-secondary font-medium hover:underline">
              View all →
            </Link>
          }
        >
          {incidents.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-4">No open incidents</p>
          ) : (
            <div className="space-y-3">
              {incidents.slice(0, 3).map((inc) => (
                <Link
                  key={inc.id}
                  href={`/admin/incidents/${inc.id}`}
                  className="flex items-start gap-3 py-2 border-b border-outline-variant/20 last:border-0"
                >
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                    INCIDENT_SEVERITY_CLS[inc.severity] ?? 'bg-gray-50 text-gray-600'
                  }`}>
                    {inc.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-on-surface capitalize truncate">
                      {inc.incident_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {staffName(inc.staff_profiles)} · {fmt(inc.occurred_at ?? inc.created_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ml-auto mt-0.5 ${
                    INCIDENT_STATUS_CLS[inc.status] ?? 'bg-gray-50 text-on-surface-variant'
                  }`}>
                    {inc.status.replace(/_/g, ' ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionBox>

      </div>

      {/* ── Desktop command center (lg+) ─────────────────────────────────── */}
      <div className="hidden lg:block">
        <AdminDashboardDesktop
          openShifts={openShifts}
          nonCompliant={nonCompliant}
          activeIncidents={incidents.length}
          activeStaff={activeStaff}
          hrIncomplete={hrIncomplete}
          expiring7d={expiring7d}
          pendingApplications={pendingApplications}
          incidents={incidents}
          topAlerts={topAlerts}
          onboardingPct={onboardingPct}
          pilotOnboarded={pilotOnboarded}
          pilotTotalStaff={pilotTotalStaff}
          today={today}
          companyName={companyName}
        />
      </div>

    </div>
  )
}
