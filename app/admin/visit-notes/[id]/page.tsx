import { notFound } from 'next/navigation'
import Link          from 'next/link'
import VisitNoteForm, { type VisitNote } from './VisitNoteForm'

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getVisitNote(id: string): Promise<VisitNote | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/visit-notes/${id}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json() as Promise<VisitNote>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VisitNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const note = await getVisitNote(id)
  if (!note) notFound()

  const clientName = note.clients
    ? `${note.clients.first_name} ${note.clients.last_name}`
    : null

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

      {/* Editor */}
      <VisitNoteForm note={note} />

    </div>
  )
}
