import StaffTable, { type StaffProfileWithCompliance } from './StaffTable'

// ── Data Fetching ─────────────────────────────────────────────────────────────

async function getStaff(): Promise<StaffProfileWithCompliance[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/staff`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<StaffProfileWithCompliance[]>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StaffPage() {
  const staff = await getStaff()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Staff</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {staff.length} profile{staff.length !== 1 ? 's' : ''}
        </p>
      </div>

      {staff.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          No staff profiles yet. Convert a hired applicant to create one.
        </div>
      ) : (
        <StaffTable staff={staff} />
      )}
    </div>
  )
}
