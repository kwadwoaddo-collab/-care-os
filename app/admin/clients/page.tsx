import CreateClientForm from './CreateClientForm'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Client {
  id:           string
  first_name:   string
  last_name:    string
  preferred_name: string | null
  postcode:     string | null
  status:       string
  funding_type: string | null
  risk_level:   string
  care_start_date: string | null
  created_at:   string
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

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getClients(): Promise<Client[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/clients`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<Client[]>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClientsPage() {
  const clients = await getClients()

  const total    = clients.length
  const active   = clients.filter((c) => c.status === 'active').length
  const paused   = clients.filter((c) => c.status === 'paused').length
  const highRisk = clients.filter((c) => c.risk_level === 'high' || c.risk_level === 'critical').length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} client{total !== 1 ? 's' : ''}
          </p>
        </div>
        <CreateClientForm />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Active</p>
          <p className="text-2xl font-semibold tabular-nums text-green-700">{active}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Paused</p>
          <p className="text-2xl font-semibold tabular-nums text-yellow-700">{paused}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">High / critical risk</p>
          <p className={`text-2xl font-semibold tabular-nums ${highRisk > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {highRisk}
          </p>
        </div>
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          No clients yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Postcode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funding</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Care start</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900">
                        {client.first_name} {client.last_name}
                      </span>
                      {client.preferred_name && (
                        <span className="ml-1.5 text-xs text-gray-400">({client.preferred_name})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {client.postcode ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={client.status} map={STATUS_CLS} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {client.funding_type ? client.funding_type.replace(/_/g, ' ') : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={client.risk_level} map={RISK_CLS} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(client.care_start_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <a
                        href={`/admin/clients/${client.id}`}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        View →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
