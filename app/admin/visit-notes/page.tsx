import VisitNotesTable, { type VisitNoteSummary } from './VisitNotesTable'
import { adminFetch } from '@/lib/admin/serverFetch'

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getVisitNotes(): Promise<VisitNoteSummary[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/visit-notes`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<VisitNoteSummary[]>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VisitNotesPage() {
  const notes = await getVisitNotes()

  const draftCount     = notes.filter((n) => n.status === 'draft').length
  const submittedCount = notes.filter((n) => n.status !== 'draft').length
  const incidentCount  = notes.filter((n) => n.incident_reported).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Visit Notes</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Total</p>
          <p className="text-2xl font-semibold tabular-nums text-primary">{notes.length}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Draft</p>
          <p className={`text-2xl font-semibold tabular-nums ${draftCount > 0 ? 'text-amber-600' : 'text-primary'}`}>
            {draftCount}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Submitted</p>
          <p className="text-2xl font-semibold tabular-nums text-primary">{submittedCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Incidents</p>
          <p className={`text-2xl font-semibold tabular-nums ${incidentCount > 0 ? 'text-red-600' : 'text-primary'}`}>
            {incidentCount}
          </p>
        </div>
      </div>

      {/* Table */}
      {notes.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-gray-400">
          No visit notes yet. Create one from the Shifts page.
        </div>
      ) : (
        <VisitNotesTable notes={notes} />
      )}

    </div>
  )
}
