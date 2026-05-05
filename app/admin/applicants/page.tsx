import Link from 'next/link'

interface ApplicantRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  job_role: string | null
  status: string
  created_at: string
  form_status: string | null
  submitted_at: string | null
}

async function getApplicants(): Promise<ApplicantRow[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/applicants`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch applicants: ${res.status}`)
  }
  return res.json() as Promise<ApplicantRow[]>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    applied:              'bg-blue-50 text-blue-700 ring-blue-600/20',
    shortlisted:          'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
    rejected:             'bg-red-50 text-red-700 ring-red-600/20',
    interview_scheduled:  'bg-purple-50 text-purple-700 ring-purple-600/20',
    hired:                'bg-green-50 text-green-700 ring-green-600/20',
    withdrawn:            'bg-gray-50 text-gray-600 ring-gray-500/20',
  }
  const cls = map[status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function FormStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>
  const map: Record<string, string> = {
    draft:     'bg-gray-50 text-gray-500 ring-gray-500/20',
    submitted: 'bg-green-50 text-green-700 ring-green-600/20',
  }
  const cls = map[status] ?? 'bg-gray-50 text-gray-500 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ApplicantsPage() {
  let applicants: ApplicantRow[] = []
  let fetchError: string | null = null

  try {
    applicants = await getApplicants()
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Applicants</h1>
        <p className="mt-1 text-sm text-gray-500">
          All applicants across the organisation.
        </p>
      </div>

      {fetchError && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 mb-6">
          {fetchError}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {applicants.length === 0 && !fetchError && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  No applicants yet.
                </td>
              </tr>
            )}
            {applicants.map((a) => (
              <tr
                key={a.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                  <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                    {a.first_name ?? ''} {a.last_name ?? ''}
                    {!a.first_name && !a.last_name && <span className="text-gray-400">—</span>}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                    {a.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                    {a.job_role ?? <span className="text-gray-400">—</span>}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                    <StatusBadge status={a.status} />
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                    <FormStatusBadge status={a.form_status} />
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                    {formatDate(a.created_at)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        {applicants.length} applicant{applicants.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
