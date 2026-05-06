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
import {
  parseAvailabilityRecord,
  type StaffAvailability,
} from '@/lib/staff/types'

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
  id:            string
  document_type: string
  file_name:     string
  file_path:     string | null
  file_size:     number | null
  expiry_date:   string | null
  created_at:    string
}

interface ComplianceItem {
  id:           string
  item_type:    string
  status:       string
  expires_at:   string | null
  completed_at: string | null
  notes:        string | null
}

interface ApiResponse {
  staff_profile:    StaffProfile
  applicant:        Applicant | null
  documents:        Document[]
  compliance_items: ComplianceItem[]
}

// ── Data Fetching ─────────────────────────────────────────────────────────────

async function getStaffDetail(id: string): Promise<ApiResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/staff/${id}`, { cache: 'no-store' })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error(`Failed to fetch staff profile: ${res.status}`)
  return res.json() as Promise<ApiResponse>
}

async function getAvailability(id: string): Promise<StaffAvailability | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/staff/${id}/availability`, { cache: 'no-store' })
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

async function getRecentShifts(id: string): Promise<StaffShift[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/staff/${id}/shifts`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<StaffShift[]>
}

async function getRecentVisitNotes(id: string): Promise<StaffVisitNote[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/visit-notes?staff_profile_id=${id}`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<StaffVisitNote[]>
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
  pending:    'bg-gray-50   text-gray-500   ring-gray-400/20',
  clocked_in: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  completed:  'bg-green-50  text-green-700  ring-green-600/20',
  missed:     'bg-red-50    text-red-700    ring-red-600/20',
  adjusted:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

// Document expiry status badge
const DOC_STATUS_CLS: Record<string, string> = {
  expired:       'bg-red-50    text-red-700    ring-red-600/20',
  expiring_soon: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  valid:         'bg-green-50  text-green-700  ring-green-600/20',
  no_expiry:     'bg-gray-50   text-gray-500   ring-gray-400/20',
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
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || '—'}</dd>
    </div>
  )
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Compliance summary card ───────────────────────────────────────────────────

function ComplianceCard({ documents }: { documents: Document[] }) {
  const summary = calculateCompliance(documents)
  const tier    = complianceTier(summary.percentage)
  const cls     = TIER_CLS[tier]

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Compliance</h2>
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
          {summary.percentage}%
        </span>
      </div>
      <div className="p-4 space-y-4">

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
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
            <p className="text-xs font-medium text-gray-500 mb-1.5">Missing documents</p>
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
            <p className="text-xs font-medium text-gray-500 mb-1.5">Expired</p>
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
            <p className="text-xs font-medium text-gray-500 mb-1.5">Expiring within 30 days</p>
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
            <p className="text-xs font-medium text-red-700 mb-1.5">Missing training</p>
            <ul className="flex flex-wrap gap-1.5">
              {summary.missingTraining.map((t) => (
                <li key={t} className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">
                  {t.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Inferred training found */}
        {summary.inferredTraining.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Training detected from documents</p>
            <ul className="flex flex-wrap gap-1.5">
              {summary.inferredTraining.map((t) => (
                <li key={t} className="text-xs bg-green-50 text-green-700 rounded px-1.5 py-0.5 ring-1 ring-inset ring-green-600/20">
                  ✓ {t.replace(/_/g, ' ')}
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
  return 'text-gray-500'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Start fetches in parallel
  const availabilityPromise   = getAvailability(id)
  const recentShiftsPromise   = getRecentShifts(id)
  const recentNotesPromise    = getRecentVisitNotes(id)

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

  const availability   = await availabilityPromise.catch(() => null)
  const recentShifts   = await recentShiftsPromise.catch(() => [])
  const recentNotes    = await recentNotesPromise.catch(() => [])

  const { staff_profile: sp, applicant, documents, compliance_items } = data

  const displayName =
    [sp.first_name, sp.last_name].filter(Boolean).join(' ') ||
    sp.email ||
    'Unknown'

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin/staff"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
      >
        ← Back to staff
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
          {sp.email && <p className="text-sm text-gray-500 mt-0.5">{sp.email}</p>}
        </div>
        <Badge status={sp.status} map={STATUS_CLS} />
      </div>

      <div className="space-y-4">

        {/* ── Compliance summary card ─────────────────────────────────────── */}
        <ComplianceCard documents={documents} />

        {/* ── Compliance review ───────────────────────────────────────────── */}
        <ComplianceReviewSection
          staffProfileId={sp.id}
          lastReviewedAt={sp.last_reviewed_at}
          lastReviewedBy={sp.last_reviewed_by}
          lastReviewNotes={sp.last_review_notes}
        />

        {/* ── Status control ──────────────────────────────────────────────── */}
        <StaffStatusControl
          staffProfileId={sp.id}
          currentStatus={sp.status}
          isCompliant={calculateCompliance(documents).compliant}
        />

        {/* ── Personal Info ──────────────────────────────────────────────── */}
        <SectionBox title="Personal Info">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="First name" value={sp.first_name} />
            <Field label="Last name"  value={sp.last_name} />
            <Field label="Email"      value={sp.email} />
            <Field label="Phone"      value={sp.phone} />
            <Field label="Job role"   value={sp.job_role ?? sp.job_title} />
            <Field label="Status"     value={sp.status.replace(/_/g, ' ')} />
            <Field label="Start date" value={formatDate(sp.start_date)} />
            <Field label="Created"    value={formatDate(sp.created_at)} />
          </dl>
        </SectionBox>

        {/* ── Linked Applicant ───────────────────────────────────────────── */}
        <SectionBox title="Linked Applicant">
          {applicant ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-gray-500">Name</dt>
                <dd className="mt-0.5 text-sm text-indigo-700">
                  <Link href={`/admin/applicants/${applicant.id}`} className="hover:underline">
                    {[applicant.first_name, applicant.last_name].filter(Boolean).join(' ') || applicant.email}
                  </Link>
                </dd>
              </div>
              <Field label="Email"       value={applicant.email} />
              <Field label="Phone"       value={applicant.phone} />
              <Field label="Job role"    value={applicant.job_role} />
              <Field label="App. status" value={applicant.status.replace(/_/g, ' ')} />
              <Field label="Applied"     value={formatDate(applicant.created_at)} />
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No linked applicant.</p>
          )}
        </SectionBox>

        {/* ── Upload Document ──────────────────────────────────────────────── */}
        <StaffDocumentUpload staffProfileId={sp.id} />

        {/* ── Documents table ─────────────────────────────────────────────── */}
        <SectionBox title="Documents">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400">No documents uploaded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    <th className="text-left pb-2 pr-4">File name</th>
                    <th className="text-left pb-2 pr-4">Type</th>
                    <th className="text-left pb-2 pr-4">Expiry</th>
                    <th className="text-left pb-2 pr-4">Status</th>
                    <th className="text-left pb-2 pr-4">Uploaded</th>
                    <th className="text-left pb-2">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {documents.map((doc) => {
                    const expStatus = docExpiryStatus(doc.expiry_date)
                    return (
                      <tr key={doc.id} className={expiryRowCls(doc.expiry_date)}>
                        <td className="py-2 pr-4 text-gray-900 truncate max-w-[200px]">{doc.file_name}</td>
                        <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{doc.document_type.replace(/_/g, ' ')}</td>
                        <td className={`py-2 pr-4 whitespace-nowrap ${expiryTextCls(doc.expiry_date)}`}>
                          {doc.expiry_date ? formatDate(doc.expiry_date) : '—'}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge status={expStatus} map={DOC_STATUS_CLS} />
                          {/* Override label via span trick */}
                          <span className="sr-only">{docExpiryLabel(expStatus)}</span>
                        </td>
                        <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{formatDate(doc.created_at)}</td>
                        <td className="py-2">
                          {doc.file_path ? (
                            <a
                              href={`/api/admin/documents/download?path=${encodeURIComponent(doc.file_path)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionBox>

        {/* ── Compliance items (from compliance_items table) ─────────────── */}
        <SectionBox title="Compliance Items">
          {compliance_items.length === 0 ? (
            <p className="text-sm text-gray-400">No compliance items recorded.</p>
          ) : (
            <div className="space-y-2">
              {compliance_items.map((ci) => (
                <div
                  key={ci.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm text-gray-900 font-medium">{ci.item_type.replace(/_/g, ' ')}</p>
                    {ci.notes && <p className="text-xs text-gray-500 mt-0.5">{ci.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {ci.expires_at && <span>Exp: {formatDate(ci.expires_at)}</span>}
                    <Badge status={ci.status} map={COMPLIANCE_CLS} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionBox>

        {/* ── Availability & Shift Readiness ──────────────────────────────── */}
        <StaffAvailabilitySection
          staffProfileId={sp.id}
          initial={availability ?? parseAvailabilityRecord(sp.id, null)}
        />

        {/* ── Recent Visit Notes ──────────────────────────────────────────── */}
        <SectionBox title="Recent Visit Notes">
          {recentNotes.length === 0 ? (
            <p className="text-sm text-gray-400">No visit notes recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    <th className="text-left pb-2 pr-4">Date</th>
                    <th className="text-left pb-2 pr-4">Client</th>
                    <th className="text-left pb-2 pr-4">Status</th>
                    <th className="text-left pb-2 pr-4">Incident</th>
                    <th className="text-left pb-2">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentNotes.map((vn) => {
                    const NOTE_STATUS_CLS: Record<string, string> = {
                      draft:     'bg-gray-50   text-gray-600   ring-gray-400/20',
                      submitted: 'bg-green-50  text-green-700  ring-green-600/20',
                      locked:    'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
                    }
                    const snCls     = NOTE_STATUS_CLS[vn.status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
                    const clientN   = vn.clients
                      ? `${vn.clients.first_name} ${vn.clients.last_name}`
                      : '—'
                    const noteDate  = vn.shifts?.shift_date ?? vn.created_at.slice(0, 10)
                    return (
                      <tr key={vn.id}>
                        <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                          {formatDate(noteDate)}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {vn.clients ? (
                            <Link href={`/admin/clients/${vn.clients.id}`} className="text-indigo-700 hover:underline">
                              {clientN}
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${snCls}`}>
                            {vn.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          {vn.incident_reported ? (
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20">
                              Yes
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2">
                          <Link href={`/admin/visit-notes/${vn.id}`} className="text-xs text-indigo-600 hover:underline">
                            View →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionBox>

        {/* ── Recent Shifts ───────────────────────────────────────────────── */}
        <SectionBox title="Recent Shifts">
          {recentShifts.length === 0 ? (
            <p className="text-sm text-gray-400">No shifts assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    <th className="text-left pb-2 pr-4">Title</th>
                    <th className="text-left pb-2 pr-4">Date</th>
                    <th className="text-left pb-2 pr-4">Time</th>
                    <th className="text-left pb-2 pr-4">Location</th>
                    <th className="text-left pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentShifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="py-2 pr-4 text-gray-900">{shift.title}</td>
                      <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                        {formatDate(shift.shift_date)}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 whitespace-nowrap tabular-nums">
                        {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                      </td>
                      <td className="py-2 pr-4 text-gray-500 max-w-[160px] truncate">
                        {shift.location ?? '—'}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <Badge status={shift.status} map={SHIFT_STATUS_CLS} />
                          {shift.timesheet_status && (
                            <Badge status={shift.timesheet_status} map={TIMESHEET_STATUS_CLS} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionBox>

      </div>
    </div>
  )
}
