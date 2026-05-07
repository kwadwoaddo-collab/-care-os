import Link from 'next/link'
import { notFound } from 'next/navigation'
import IncidentEditForm from './IncidentEditForm'
import { adminFetch } from '@/lib/admin/serverFetch'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Incident {
  id:                    string
  company_id:            string
  visit_note_id:         string | null
  shift_id:              string | null
  client_id:             string | null
  staff_profile_id:      string | null
  incident_type:         string
  severity:              string
  status:                string
  occurred_at:           string | null
  description:           string
  immediate_action_taken: string | null
  escalation_required:   boolean
  escalated_to:          string | null
  follow_up_required:    boolean
  follow_up_notes:       string | null
  resolved_at:           string | null
  resolution_notes:      string | null
  created_at:            string
  updated_at:            string
  clients:               { id: string; first_name: string; last_name: string } | null
  staff_profiles:        { id: string; first_name: string | null; last_name: string | null; email: string | null } | null
  shifts:                { id: string; title: string; shift_date: string; start_time: string; end_time: string } | null
  visit_notes:           { id: string; status: string; incident_notes: string | null; created_at: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_CLS: Record<string, string> = {
  low:      'bg-gray-50    text-gray-600   ring-gray-400/20',
  medium:   'bg-yellow-50  text-yellow-700 ring-yellow-600/20',
  high:     'bg-orange-50  text-orange-700 ring-orange-600/20',
  critical: 'bg-red-50     text-red-700    ring-red-600/20',
}

const STATUS_CLS: Record<string, string> = {
  open:          'bg-red-50     text-red-700    ring-red-600/20',
  investigating: 'bg-blue-50    text-blue-700   ring-blue-600/20',
  resolved:      'bg-green-50   text-green-700  ring-green-600/20',
  closed:        'bg-gray-50    text-gray-500   ring-gray-400/20',
}

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <dt className="w-44 shrink-0 text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</dd>
    </div>
  )
}

function staffName(s: { first_name: string | null; last_name: string | null; email: string | null } | null): string {
  if (!s) return '—'
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || '—'
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getIncident(id: string): Promise<Incident | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/incidents/${id}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json() as Promise<Incident>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const incident = await getIncident(id)
  if (!incident) notFound()

  return (
    <div className="space-y-6">

      {/* Breadcrumb + header */}
      <div>
        <Link
          href="/admin/incidents"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Back to incidents
        </Link>

        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-semibold text-gray-900">
            Incident · {incident.incident_type.replace(/_/g, ' ')}
          </h1>
          <Badge value={incident.severity} map={SEVERITY_CLS} />
          <Badge value={incident.status}   map={STATUS_CLS} />
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          Created {formatDateTime(incident.created_at)}
          {incident.occurred_at && ` · Occurred ${formatDateTime(incident.occurred_at)}`}
        </p>
      </div>

      {/* Top-level info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Incident summary */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Summary</h2>
          <dl>
            <DetailRow label="Type"       value={incident.incident_type.replace(/_/g, ' ')} />
            <DetailRow label="Severity"   value={<Badge value={incident.severity} map={SEVERITY_CLS} />} />
            <DetailRow label="Status"     value={<Badge value={incident.status} map={STATUS_CLS} />} />
            <DetailRow label="Occurred at" value={formatDateTime(incident.occurred_at)} />
            <DetailRow label="Created at"  value={formatDateTime(incident.created_at)} />
            {incident.resolved_at && (
              <DetailRow label="Resolved at" value={formatDateTime(incident.resolved_at)} />
            )}
          </dl>
        </section>

        {/* Linked entities */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Linked Records</h2>
          <dl>
            <DetailRow
              label="Client"
              value={
                incident.clients ? (
                  <Link href={`/admin/clients/${incident.clients.id}`} className="text-indigo-700 hover:underline">
                    {incident.clients.first_name} {incident.clients.last_name}
                  </Link>
                ) : null
              }
            />
            <DetailRow
              label="Staff"
              value={
                incident.staff_profiles ? (
                  <Link href={`/admin/staff/${incident.staff_profiles.id}`} className="text-indigo-700 hover:underline">
                    {staffName(incident.staff_profiles)}
                  </Link>
                ) : null
              }
            />
            <DetailRow
              label="Shift"
              value={
                incident.shifts ? (
                  <span className="text-sm">
                    {incident.shifts.title} — {formatDate(incident.shifts.shift_date)}{' '}
                    {incident.shifts.start_time.slice(0, 5)}–{incident.shifts.end_time.slice(0, 5)}
                  </span>
                ) : null
              }
            />
            <DetailRow
              label="Visit note"
              value={
                incident.visit_notes ? (
                  <Link href={`/admin/visit-notes/${incident.visit_notes.id}`} className="text-indigo-700 hover:underline">
                    {incident.visit_notes.status} — {formatDate(incident.visit_notes.created_at)}
                  </Link>
                ) : null
              }
            />
          </dl>
        </section>

      </div>

      {/* Description */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">Description</h2>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {incident.description || <span className="text-gray-400">No description provided.</span>}
        </p>
      </section>

      {/* Current details (read-only) */}
      {(incident.immediate_action_taken || incident.escalated_to || incident.follow_up_notes || incident.resolution_notes) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {incident.immediate_action_taken && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Immediate Action Taken</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{incident.immediate_action_taken}</p>
            </section>
          )}
          {incident.escalation_required && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Escalation</h2>
              <p className="text-sm text-gray-700">
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20 mr-2">
                  Escalation required
                </span>
                {incident.escalated_to && <>to: {incident.escalated_to}</>}
              </p>
            </section>
          )}
          {incident.follow_up_notes && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Follow-up Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{incident.follow_up_notes}</p>
            </section>
          )}
          {incident.resolution_notes && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Resolution Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{incident.resolution_notes}</p>
            </section>
          )}
        </div>
      )}

      {/* Editable form */}
      <IncidentEditForm
        incidentId={incident.id}
        initial={{
          severity:               incident.severity,
          status:                 incident.status,
          immediate_action_taken: incident.immediate_action_taken,
          escalation_required:    incident.escalation_required,
          escalated_to:           incident.escalated_to,
          follow_up_required:     incident.follow_up_required,
          follow_up_notes:        incident.follow_up_notes,
          resolution_notes:       incident.resolution_notes,
        }}
      />
    </div>
  )
}
