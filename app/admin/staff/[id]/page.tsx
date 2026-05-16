import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  calculateCompliance,
  complianceTier,
  TIER_CLS,
} from '@/lib/compliance/calculateCompliance'
import StaffDocumentUpload       from './StaffDocumentUpload'
import StaffStatusControl        from './StaffStatusControl'
import ComplianceReviewSection   from './ComplianceReviewSection'
import StaffAvailabilitySection  from './StaffAvailabilitySection'
import PortalInviteButton        from './PortalInviteButton'
import EditStaffProfileForm      from './EditStaffProfileForm'
import EditHrDetailsForm         from './EditHrDetailsForm'
import OnboardingChecklist       from './OnboardingChecklist'
import OnboardingTimeline        from './OnboardingTimeline'
import DocumentApprovalButton    from './DocumentApprovalButton'
import { calculateHrReadiness }  from '@/lib/staff/calculateHrReadiness'
import { calculateOnboardingStatus } from '@/lib/staff/calculateOnboardingStatus'
import {
  parseAvailabilityRecord,
  type StaffAvailability,
} from '@/lib/staff/types'
import { adminFetch }          from '@/lib/admin/serverFetch'
import RoleManagementPanel     from './RoleManagementPanel'
import { requireAdmin }        from '@/lib/auth/requireAdmin'
import { adminClient }         from '@/lib/supabase/admin'
import { canManageRoles }      from '@/lib/rbac/can'
import AdminAccessButton    from './AdminAccessButton'
import DeleteStaffButton    from './DeleteStaffButton'
import StaffProfileMobile  from '@/components/admin/StaffProfileMobile'
import StaffProfileDesktop from '@/components/admin/StaffProfileDesktop'
import RecruitmentFileTab  from './RecruitmentFileTab'
import { can }             from '@/lib/rbac/permissions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffProfile {
  id:                 string
  company_id:         string
  applicant_id:       string | null
  profile_id:         string | null
  first_name:         string | null
  last_name:          string | null
  email:              string | null
  phone:              string | null
  job_role:           string | null
  job_title:          string | null
  status:             string
  start_date:         string | null
  created_at:         string
  updated_at:         string
  last_reviewed_at?:  string | null
  last_reviewed_by?:  string | null
  last_review_notes?: string | null
  // HR / personal
  middle_name?:  string | null
  date_of_birth?: string | null
  gender?:        string | null
  nationality?:   string | null
  // Address
  address_line_1?: string | null
  address_line_2?: string | null
  city?:           string | null
  postcode?:       string | null
  // Emergency
  emergency_contact_name?:         string | null
  emergency_contact_phone?:        string | null
  emergency_contact_relationship?: string | null
  // Employment
  employment_type?:     string | null
  contracted_hours?:    number | null
  start_date_confirmed?: boolean | null
  // Payroll
  ni_number?:           string | null
  tax_code?:            string | null
  payroll_number?:      string | null
  utr_number?:          string | null
  starter_declaration?: string | null
  // Bank
  bank_name?:           string | null
  bank_account_name?:   string | null
  bank_account_number?: string | null
  bank_sort_code?:      string | null
  // Compliance metadata
  right_to_work_checked?: boolean | null
  dbs_checked?:           boolean | null
  dbs_number?:            string | null
  dbs_expiry_date?:       string | null
  // Onboarding
  onboarding_completed?:       boolean | null
  policy_acknowledged?:        boolean | null
  policy_acknowledged_at?:     string | null
  portal_last_login_at?:       string | null
  portal_invite_sent_at?:      string | null
  // Admin access (presence only — hash never sent to client)
  portal_token_hash?:          string | null   // non-null = worker portal active
  admin_invite_sent_at?:       string | null
}

interface Applicant {
  id:         string
  first_name: string | null
  last_name:  string | null
  email:      string
  phone:      string | null
  job_role:   string | null
  status:     string
  created_at: string
}

interface Document {
  id:                string
  document_type:     string
  file_name:         string
  file_path:         string | null
  file_size:         number | null
  expiry_date:       string | null
  issue_date:        string | null
  training_category: string | null
  applicant_id:      string | null
  created_at:        string
  reviewed_status:   string | null
  review_notes:      string | null
  reviewed_by:       string | null
  reviewed_at:       string | null
}

interface ComplianceItem {
  id:           string
  item_type:    string
  status:       string
  expires_at:   string | null
  completed_at: string | null
  notes:        string | null
}

interface HrReadiness {
  ready:   boolean
  score:   number
  missing: string[]
}

interface ApiResponse {
  staff_profile:    StaffProfile
  applicant:        Applicant | null
  documents:        Document[]
  compliance_items: ComplianceItem[]
  hr_readiness:     HrReadiness
}

// ── Data Fetching ─────────────────────────────────────────────────────────────

async function getStaffDetail(id: string): Promise<ApiResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/staff/${id}`, { cache: 'no-store' })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error(`Failed to fetch staff profile: ${res.status}`)
  return res.json() as Promise<ApiResponse>
}

async function getAvailability(id: string): Promise<StaffAvailability | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/staff/${id}/availability`, { cache: 'no-store' })
  if (!res.ok) return null
  const raw = await res.json() as Record<string, unknown>
  return parseAvailabilityRecord(id, raw)
}

interface StaffShift {
  id:               string
  title:            string
  shift_date:       string
  start_time:       string
  end_time:         string
  status:           string
  location:         string | null
  client_name:      string | null
  shift_type:       string | null
  timesheet_status: string | null
}

interface StaffVisitNote {
  id:                string
  status:            string
  incident_reported: boolean
  submitted_at:      string | null
  created_at:        string
  shifts: {
    shift_date: string
    start_time: string
    end_time:   string
  } | null
  clients: {
    id:         string
    first_name: string
    last_name:  string
  } | null
}

interface StaffIncident {
  id:            string
  incident_type: string
  severity:      string
  status:        string
  occurred_at:   string | null
  created_at:    string
  clients:       { id: string; first_name: string; last_name: string } | null
}

async function getRecentShifts(id: string): Promise<StaffShift[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/staff/${id}/shifts`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<StaffShift[]>
}

async function getRecentVisitNotes(id: string): Promise<StaffVisitNote[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/visit-notes?staff_profile_id=${id}`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<StaffVisitNote[]>
}

async function getRecentIncidents(id: string): Promise<StaffIncident[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/incidents?staff_profile_id=${id}&pageSize=10`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json() as { data: StaffIncident[] }
  return json.data
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Returns true if the date is in the past */
function isExpired(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

/** Returns true if the date is within 30 days but not expired */
function isExpiringSoon(iso: string | null): boolean {
  if (!iso) return false
  const expiry  = new Date(iso)
  const now     = new Date()
  const warnAt  = new Date()
  warnAt.setDate(now.getDate() + 30)
  return expiry > now && expiry <= warnAt
}

const STATUS_CLS: Record<string, string> = {
  pre_employment: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  active:         'bg-green-50  text-green-700  ring-green-600/20',
  suspended:      'bg-orange-50 text-orange-700 ring-orange-600/20',
  terminated:     'bg-red-50    text-red-700    ring-red-600/20',
  inactive:       'bg-gray-50   text-gray-600   ring-gray-500/20',
}

const SHIFT_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  confirmed: 'bg-green-50  text-green-700  ring-green-600/20',
  completed: 'bg-gray-50   text-gray-600   ring-gray-500/20',
  cancelled: 'bg-red-50    text-red-700    ring-red-600/20',
  no_show:   'bg-orange-50 text-orange-700 ring-orange-600/20',
}

const TIMESHEET_STATUS_CLS: Record<string, string> = {
  pending:    'bg-gray-50   text-on-surface-variant   ring-gray-400/20',
  clocked_in: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  completed:  'bg-green-50  text-green-700  ring-green-600/20',
  missed:     'bg-red-50    text-red-700    ring-red-600/20',
  adjusted:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

const INCIDENT_SEVERITY_CLS: Record<string, string> = {
  low:      'bg-gray-50    text-gray-600   ring-gray-400/20',
  medium:   'bg-yellow-50  text-yellow-700 ring-yellow-600/20',
  high:     'bg-orange-50  text-orange-700 ring-orange-600/20',
  critical: 'bg-red-50     text-red-700    ring-red-600/20',
}

const INCIDENT_STATUS_CLS: Record<string, string> = {
  open:          'bg-red-50     text-red-700    ring-red-600/20',
  investigating: 'bg-blue-50    text-blue-700   ring-blue-600/20',
  resolved:      'bg-green-50   text-green-700  ring-green-600/20',
  closed:        'bg-gray-50    text-on-surface-variant   ring-gray-400/20',
}

// Document expiry status badge
const DOC_STATUS_CLS: Record<string, string> = {
  expired:       'bg-red-50    text-red-700    ring-red-600/20',
  expiring_soon: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  valid:         'bg-green-50  text-green-700  ring-green-600/20',
  no_expiry:     'bg-gray-50   text-on-surface-variant   ring-gray-400/20',
}

function docExpiryStatus(expiryDate: string | null): string {
  if (!expiryDate)             return 'no_expiry'
  if (isExpired(expiryDate))   return 'expired'
  if (isExpiringSoon(expiryDate)) return 'expiring_soon'
  return 'valid'
}

function docExpiryLabel(status: string): string {
  const map: Record<string, string> = {
    expired:       'Expired',
    expiring_soon: 'Expiring soon',
    valid:         'Valid',
    no_expiry:     'No expiry',
  }
  return map[status] ?? status
}

const COMPLIANCE_CLS: Record<string, string> = {
  not_started: 'bg-gray-50   text-gray-600   ring-gray-500/20',
  in_progress: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  complete:    'bg-green-50  text-green-700  ring-green-600/20',
  rejected:    'bg-red-50    text-red-700    ring-red-600/20',
  expired:     'bg-orange-50 text-orange-700 ring-orange-600/20',
}

function Badge({ status, map }: { status: string; map: Record<string, string> }) {
  const cls = map[status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 text-sm text-primary">{value || '—'}</dd>
    </div>
  )
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Compliance summary card ───────────────────────────────────────────────────

function ComplianceCard({ documents, jobRole }: { documents: Document[], jobRole: string | null }) {
  const summary = calculateCompliance(documents)
  const tier    = complianceTier(summary.percentage)
  const cls     = TIER_CLS[tier]

  // Derive training labels for display
  const { TRAINING_CATEGORY_LABELS } = require('@/lib/documents/constants')
  const catLabel = (cat: string): string =>
    (TRAINING_CATEGORY_LABELS as Record<string, string>)[cat] ?? cat.replace(/_/g, ' ')

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Compliance</h2>
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
          {summary.percentage}%
        </span>
      </div>
      <div className="p-4 space-y-4">

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-on-surface-variant mb-1">
            <span>Overall compliance</span>
            <span className="font-medium">{summary.percentage}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                tier === 'green' ? 'bg-green-500' :
                tier === 'amber' ? 'bg-yellow-400' :
                'bg-red-500'
              }`}
              style={{ width: `${summary.percentage}%` }}
            />
          </div>
        </div>

        {/* Issues grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Missing documents */}
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs font-medium text-on-surface-variant mb-1.5">Missing documents</p>
            {summary.missingDocuments.length === 0 ? (
              <p className="text-xs text-green-600">✓ None</p>
            ) : (
              <ul className="space-y-0.5">
                {summary.missingDocuments.map((d) => (
                  <li key={d} className="text-xs text-red-600">✕ {d.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Expired documents */}
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs font-medium text-on-surface-variant mb-1.5">Expired</p>
            {summary.expiredDocuments.length === 0 ? (
              <p className="text-xs text-green-600">✓ None</p>
            ) : (
              <ul className="space-y-0.5">
                {summary.expiredDocuments.map((d) => (
                  <li key={d} className="text-xs text-red-600">✕ {d.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Expiring soon */}
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs font-medium text-on-surface-variant mb-1.5">Expiring within 30 days</p>
            {summary.expiringSoon.length === 0 ? (
              <p className="text-xs text-green-600">✓ None</p>
            ) : (
              <ul className="space-y-0.5">
                {summary.expiringSoon.map((d) => (
                  <li key={d} className="text-xs text-yellow-600">⚠ {d.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            )}
          </div>

        </div>

        {/* Missing training */}
        {summary.missingTraining.length > 0 && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-xs font-medium text-red-700 mb-1.5">Missing / expired training</p>
            <ul className="flex flex-wrap gap-1.5">
              {summary.missingTraining.map((t) => (
                <li key={t} className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">
                  {catLabel(t)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Satisfied training */}
        {summary.satisfiedTraining.length > 0 && (
          <div>
            <p className="text-xs font-medium text-on-surface-variant mb-1.5">Approved training</p>
            <ul className="flex flex-wrap gap-1.5">
              {summary.satisfiedTraining.map((t) => (
                <li key={t} className="text-xs bg-green-50 text-green-700 rounded px-1.5 py-0.5 ring-1 ring-inset ring-green-600/20">
                  ✓ {catLabel(t)}
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Expiry colour helper (Task 6) ─────────────────────────────────────────────

function expiryRowCls(expiryDate: string | null): string {
  if (isExpired(expiryDate))     return 'bg-red-50'
  if (isExpiringSoon(expiryDate)) return 'bg-yellow-50'
  if (expiryDate)                 return 'bg-green-50/40'
  return ''
}

function expiryTextCls(expiryDate: string | null): string {
  if (isExpired(expiryDate))     return 'text-red-600 font-medium'
  if (isExpiringSoon(expiryDate)) return 'text-yellow-700 font-medium'
  if (expiryDate)                 return 'text-green-700'
  return 'text-on-surface-variant'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const isRecruitmentTab = tab === 'recruitment'

  // Start fetches in parallel
  const availabilityPromise    = getAvailability(id)
  const recentShiftsPromise    = getRecentShifts(id)
  const recentNotesPromise     = getRecentVisitNotes(id)
  const recentIncidentsPromise = getRecentIncidents(id)

  let data: ApiResponse
  try {
    data = await getStaffDetail(id)
  } catch (err) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {err instanceof Error ? err.message : 'Failed to load staff profile.'}
      </div>
    )
  }

  const availability    = await availabilityPromise.catch(() => null)
  const recentShifts    = await recentShiftsPromise.catch(() => [])
  const recentNotes     = await recentNotesPromise.catch(() => [])
  const recentIncidents = await recentIncidentsPromise.catch(() => [] as StaffIncident[])

  const { staff_profile: sp, applicant, documents, compliance_items, hr_readiness } = data

  // If the API didn't return hr_readiness (shouldn't happen post-migration), compute client-side
  const hrReadiness = hr_readiness ?? calculateHrReadiness({
    date_of_birth:          sp.date_of_birth,
    address_line_1:         sp.address_line_1,
    ni_number:              sp.ni_number,
    bank_account_number:    sp.bank_account_number,
    emergency_contact_name: sp.emergency_contact_name,
    employment_type:        sp.employment_type,
    starter_declaration:    sp.starter_declaration,
  })

  // ── RBAC: fetch caller role + staff member's profile role ─────────────────
  let callerRole        = 'coordinator'   // safe fallback — hides change button
  let staffProfileRole: string | null = null
  let lastChangedBy:    string | null = null
  let lastChangedAt:    string | null = null

  // Portal access state (computed here server-side, presence only)
  const portalTokenActive = !!(sp.portal_token_hash)
  const adminInviteSentAt = (sp.admin_invite_sent_at as string | null) ?? null

  try {
    const auth = await requireAdmin()
    if (auth.ok) {
      callerRole = auth.ctx.role

      // Fetch staff member's linked profile role
      if (sp.profile_id) {
        const { data: linkedProfile } = await adminClient
          .from('profiles')
          .select('role')
          .eq('id', sp.profile_id)
          .maybeSingle()
        staffProfileRole = (linkedProfile?.role as string | null) ?? null

        // Fetch last role change from audit log
        const { data: lastChange } = await adminClient
          .from('audit_logs')
          .select('actor_id, metadata, created_at')
          .eq('entity_type', 'profile')
          .eq('entity_id', sp.profile_id)
          .eq('action', 'role.assigned')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastChange?.actor_id) {
          lastChangedAt = lastChange.created_at as string
          const { data: actor } = await adminClient
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', lastChange.actor_id as string)
            .maybeSingle()
          if (actor) {
            lastChangedBy = [actor.first_name, actor.last_name].filter(Boolean).join(' ')
              || (actor.email as string | null)
          }
        }
      }
    }
  } catch { /* non-critical — page still renders */ }

  const displayName =
    [sp.first_name, sp.last_name].filter(Boolean).join(' ') ||
    sp.email ||
    'Unknown'

  return (
    <div>
      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="mb-6 border-b border-outline-variant">
        <nav className="-mb-px flex space-x-8">
          <Link
            href={`/admin/staff/${id}`}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              !isRecruitmentTab
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:border-outline-variant hover:text-gray-700'
            }`}
          >
            Profile
          </Link>
          {sp.applicant_id && (
            <Link
              href={`/admin/staff/${id}?tab=recruitment`}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                isRecruitmentTab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:border-outline-variant hover:text-gray-700'
              }`}
            >
              Recruitment File
            </Link>
          )}
        </nav>
      </div>

      {isRecruitmentTab ? (
        <RecruitmentFileTab staffProfileId={sp.id} applicantId={sp.applicant_id as string} documents={documents} convertedAt={sp.created_at} />
      ) : (
        <>
          {/* ── Mobile View (hidden on desktop) ──────────────────────────────── */}
      <div className="block lg:hidden -mx-4 -mt-4">
        <StaffProfileMobile
          staffProfile={sp}
          documents={documents}
          availability={availability}
          recentShifts={recentShifts}
          recentNotes={recentNotes}
        />
      </div>

      {/* ── Desktop View (hidden on mobile) ──────────────────────────────── */}
      <div className="hidden lg:block">
        <StaffProfileDesktop
          staffProfile={sp}
          documents={documents}
          availability={availability}
          recentShifts={recentShifts}
          recentNotes={recentNotes}
          recentIncidents={recentIncidents}
        />
      </div>{/* end lg:block wrapper */}

      {/* ── Role & Access Management ─────────────────────────────────────── */}
      <div className="mt-6">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="bg-surface-container-low border-b border-outline-variant px-6 py-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">admin_panel_settings</span>
            <h2 className="text-sm font-semibold text-primary">Role & Access Management</h2>
          </div>
          <div className="p-6">
            <RoleManagementPanel
              staffProfileId={sp.id}
              profileId={sp.profile_id}
              currentRole={staffProfileRole}
              callerRole={callerRole}
              lastChangedBy={lastChangedBy}
              lastChangedAt={lastChangedAt}
              portalTokenActive={portalTokenActive}
              portalLastLoginAt={sp.portal_last_login_at ?? null}
              portalInviteSentAt={sp.portal_invite_sent_at ?? null}
              adminInviteSentAt={adminInviteSentAt}
            />

            {/* Admin Access invite (if no admin account yet) */}
            {!sp.profile_id && canManageRoles(callerRole) && (
              <div className="mt-6 pt-4 border-t border-outline-variant">
                <p className="text-sm text-on-surface-variant mb-3">
                  This person does not have admin portal access. Create an admin account to assign a system role.
                </p>
                <AdminAccessButton
                  staffProfileId={sp.id}
                  adminInviteSentAt={adminInviteSentAt}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
      {(callerRole === 'company_admin' || callerRole === 'super_admin') && sp.status === 'terminated' && (
        <div className="mt-6">
          <div className="bg-surface-container-lowest rounded-xl border border-red-200 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[20px]">warning</span>
              <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Permanently delete this staff member</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  This staff member is archived. Permanent deletion removes all profile data and cannot be undone.
                </p>
              </div>
              <DeleteStaffButton
                staffProfileId={sp.id}
                staffName={[sp.first_name, sp.last_name].filter(Boolean).join(' ') || sp.email || 'this person'}
              />
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
