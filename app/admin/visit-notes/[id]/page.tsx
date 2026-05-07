import { notFound } from 'next/navigation'
import Link          from 'next/link'
import VisitNoteForm, { type VisitNote } from './VisitNoteForm'
import CreateIncidentFromNoteButton from './CreateIncidentFromNoteButton'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitNoteExtended extends VisitNote {
  company_id:       string
  shift_id:         string | null
  client_id:        string | null
  staff_profile_id: string | null
}

interface LinkedIncident {
  id:            string
  incident_type: string
  severity:      string
  status:        string
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getVisitNote(id: string): Promise<VisitNoteExtended | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/visit-notes/${id}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json() as Promise<VisitNoteExtended>
}

async function getLinkedIncident(visitNoteId: string): Promise<LinkedIncident | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/admin/incidents?visit_note_id=${visitNoteId}&pageSize=1`,
    { cache: 'no-store' },
  )
  if (!res.ok) return null
  const json = await res.json() as { data: LinkedIncident[] }
  return json.data?.[0] ?? null
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VisitNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [note, linkedIncident] = await Promise.all([
    getVisitNote(id),
    getLinkedIncident(id),
  ])
  if (!note) notFound()

  const clientName = note.clients
    ? `${note.clients.first_name} ${note.clients.last_name}`
    : null

  const isLocked = note.status === 'submitted' || note.status === 'locked'

  return (
    <div className="space-y-4 max-w-3xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/visit-notes" className="hover:text-gray-600 transition-colors">
          Visit Notes
        </Link>
        <span>/</span>
        <span className="text-gray-700 truncate">
          {clientName ?? note.shifts?.title ?? note.id.slice(0, 8)}
        </span>
      </div>

      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Visit Note{clientName ? ` — ${clientName}` : ''}
        </h1>
        {note.shifts && (
          <p className="text-sm text-gray-500 mt-0.5">
            {note.shifts.shift_date} · {note.shifts.start_time.slice(0, 5)}–{note.shifts.end_time.slice(0, 5)}
          </p>
        )}
      </div>

      {/* Linked incident banner (Task 4) */}
      {linkedIncident && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-800">Linked Incident</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              {linkedIncident.incident_type.replace(/_/g, ' ')} ·{' '}
              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${SEVERITY_CLS[linkedIncident.severity] ?? ''}`}>
                {linkedIncident.severity}
              </span>{' '}
              ·{' '}
              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLS[linkedIncident.status] ?? ''}`}>
                {linkedIncident.status}
              </span>
            </p>
          </div>
          <Link
            href={`/admin/incidents/${linkedIncident.id}`}
            className="text-sm text-indigo-600 hover:underline font-medium whitespace-nowrap"
          >
            View incident →
          </Link>
        </div>
      )}

      {/* Create incident from note button (Task 3) */}
      {isLocked && !linkedIncident && (
        <CreateIncidentFromNoteButton
          visitNoteId={id}
          shiftId={note.shift_id}
          clientId={note.client_id}
          staffProfileId={note.staff_profile_id}
          incidentNotes={note.incident_notes}
          generalNotes={note.general_notes}
          shiftDate={note.shifts?.shift_date ?? null}
          startTime={note.shifts?.start_time ?? null}
        />
      )}

      {/* Editor */}
      <VisitNoteForm note={note} />

    </div>
  )
}
