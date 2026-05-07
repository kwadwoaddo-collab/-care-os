import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// ── GET /api/worker/visit-notes/[id]?token=xxx ────────────────────────────────
// Fetches a single visit note by ID. The worker must be the assigned staff member
// for the note (staff_profile_id === worker.id).

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId } = result.worker
  const { id: noteId }         = await params

  const { data: note, error } = await adminClient
    .from('visit_notes')
    .select('*')
    .eq('id', noteId)
    .maybeSingle()

  if (error) {
    console.error('[worker/visit-notes/[id]] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch visit note' }, { status: 500 })
  }

  if (!note) return NextResponse.json({ error: 'Visit note not found' }, { status: 404 })

  const n = note as { id: string; staff_profile_id: string | null }

  if (n.staff_profile_id !== staffProfileId) {
    return NextResponse.json({ error: 'This visit note is not yours' }, { status: 403 })
  }

  return NextResponse.json(note)
}
