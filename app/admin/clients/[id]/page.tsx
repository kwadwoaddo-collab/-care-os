import { notFound } from 'next/navigation'
import EditClientForm from './EditClientForm'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Client {
  id:                             string
  first_name:                     string
  last_name:                      string
  preferred_name:                 string | null
  date_of_birth:                  string | null
  phone:                          string | null
  email:                          string | null
  address_line_1:                 string | null
  address_line_2:                 string | null
  town_city:                      string | null
  postcode:                       string | null
  status:                         string
  care_start_date:                string | null
  care_end_date:                  string | null
  funding_type:                   string | null
  risk_level:                     string
  emergency_contact_name:         string | null
  emergency_contact_phone:        string | null
  emergency_contact_relationship: string | null
  notes:                          string | null
  created_at:                     string
}

interface Shift {
  id:                string
  title:             string
  shift_date:        string
  start_time:        string
  end_time:          string
  status:            string
  assigned_staff_id: string | null
  care_package_id:   string | null
  staff_profiles: {
    first_name: string | null
    last_name:  string | null
    email:      string | null
  } | null
  care_packages: {
    id:    string
    title: string
  } | null
}

interface CarePackageVisit {
  id:          string
  day_of_week: number
  start_time:  string
  end_time:    string
}

interface CarePackage {
  id:                  string
  title:               string
  status:              string
  weekly_hours:        number | null
  start_date:          string
  end_date:            string | null
  funding_type:        string | null
  care_package_visits: CarePackageVisit[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  active:      'bg-green-50  text-green-700  ring-green-600/20',
  paused:      'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  ended:       'bg-gray-50   text-gray-500   ring-gray-400/20',
  prospective: 'bg-blue-50   text-blue-700   ring-blue-600/20',
}

const RISK_CLS: Record<string, string> = {
  low:      'bg-gray-50   text-gray-500   ring-gray-400/20',
  standard: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  high:     'bg-orange-50 text-orange-700 ring-orange-600/20',
  critical: 'bg-red-50    text-red-700    ring-red-600/20',
}

const SHIFT_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  confirmed: 'bg-green-50  text-green-700  ring-green-600/20',
  completed: 'bg-gray-50   text-gray-600   ring-gray-500/20',
  cancelled: 'bg-red-50    text-red-700    ring-red-600/20',
  no_show:   'bg-orange-50 text-orange-700 ring-orange-600/20',
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
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <dt className="w-44 shrink-0 text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</dd>
    </div>
  )
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getClient(id: string): Promise<Client | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/clients/${id}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json() as Promise<Client>
}

async function getClientShifts(clientId: string): Promise<Shift[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/clients/${clientId}/shifts`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<Shift[]>
}

async function getClientCarePackages(clientId: string): Promise<CarePackage[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/clients/${clientId}/care-packages`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<CarePackage[]>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [client, shifts, carePackages] = await Promise.all([
    getClient(id),
    getClientShifts(id),
    getClientCarePackages(id),
  ])

  if (!client) notFound()

  const fullName = [client.first_name, client.last_name].join(' ')

  const staffName = (s: Shift) => {
    if (!s.staff_profiles) return '—'
    return (
      [s.staff_profiles.first_name, s.staff_profiles.last_name].filter(Boolean).join(' ') ||
      s.staff_profiles.email ||
      '—'
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <a href="/admin/clients" className="text-sm text-gray-400 hover:text-gray-600">← Clients</a>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">{fullName}</h1>
          {client.preferred_name && (
            <p className="text-sm text-gray-500">Known as {client.preferred_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge value={client.status} map={STATUS_CLS} />
          <Badge value={client.risk_level} map={RISK_CLS} />
          <EditClientForm client={client} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Personal details */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Personal details</h2>
          <dl>
            <DetailRow label="Date of birth"  value={formatDate(client.date_of_birth)} />
            <DetailRow label="Phone"          value={client.phone} />
            <DetailRow label="Email"          value={client.email} />
          </dl>
        </section>

        {/* Address */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Address</h2>
          <dl>
            <DetailRow label="Line 1"    value={client.address_line_1} />
            <DetailRow label="Line 2"    value={client.address_line_2} />
            <DetailRow label="Town/city" value={client.town_city} />
            <DetailRow label="Postcode"  value={client.postcode} />
          </dl>
        </section>

        {/* Care & funding */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Care &amp; funding</h2>
          <dl>
            <DetailRow label="Funding type"
              value={client.funding_type ? client.funding_type.replace(/_/g, ' ') : null} />
            <DetailRow label="Care start" value={formatDate(client.care_start_date)} />
            <DetailRow label="Care end"   value={formatDate(client.care_end_date)} />
            <DetailRow label="Risk level" value={<Badge value={client.risk_level} map={RISK_CLS} />} />
          </dl>
        </section>

        {/* Emergency contact */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Emergency contact</h2>
          <dl>
            <DetailRow label="Name"         value={client.emergency_contact_name} />
            <DetailRow label="Phone"        value={client.emergency_contact_phone} />
            <DetailRow label="Relationship" value={client.emergency_contact_relationship} />
          </dl>
        </section>

      </div>

      {/* Notes */}
      {client.notes && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
        </section>
      )}

      {/* Care packages */}
      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Care packages</h2>
          <a href="/admin/care-packages" className="text-xs text-indigo-600 hover:underline">
            Manage →
          </a>
        </div>

        {carePackages.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            No care packages for this client.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {carePackages.map((pkg) => {
              const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              const PKG_STATUS_CLS: Record<string, string> = {
                active: 'bg-green-50  text-green-700  ring-green-600/20',
                draft:  'bg-gray-50   text-gray-500   ring-gray-400/20',
                paused: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
                ended:  'bg-gray-50   text-gray-400   ring-gray-300/20',
              }
              const statusCls = PKG_STATUS_CLS[pkg.status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
              const sortedVisits = [...pkg.care_package_visits].sort((a, b) => a.day_of_week - b.day_of_week)
              const visitSummary = sortedVisits.length === 0
                ? 'No visits'
                : sortedVisits.map((v) => `${DAYS_SHORT[v.day_of_week]} ${v.start_time.slice(0, 5)}–${v.end_time.slice(0, 5)}`).join(', ')
              return (
                <div key={pkg.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{pkg.title}</span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusCls}`}>
                        {pkg.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{visitSummary}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {pkg.weekly_hours != null && (
                      <p className="text-sm font-medium text-gray-700 tabular-nums">{pkg.weekly_hours} hrs/wk</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      From {formatDate(pkg.start_date)}{pkg.end_date ? ` to ${formatDate(pkg.end_date)}` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent shifts */}
      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Recent shifts</h2>
        </div>

        {shifts.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            No shifts recorded for this client.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(shift.shift_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                      {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-900">{shift.title}</span>
                      {shift.care_packages && (
                        <span className="ml-1.5 text-xs text-indigo-500">{shift.care_packages.title}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {shift.assigned_staff_id ? (
                        <a
                          href={`/admin/staff/${shift.assigned_staff_id}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {staffName(shift)}
                        </a>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={shift.status} map={SHIFT_STATUS_CLS} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
