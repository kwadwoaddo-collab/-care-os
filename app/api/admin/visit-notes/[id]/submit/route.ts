import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

// ── POST /api/admin/visit-notes/[id]/submit ───────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: existing, error: fetchErr } = await adminClient
    .from('visit_notes')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Visit note not found' }, { status: 404 })
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: `Visit note is already ${existing.status as string}` },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()

  const { data: note, error: updateErr } = await adminClient
    .from('visit_notes')
    .update({ status: 'submitted', submitted_at: now, updated_at: now })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    console.error('[visit-notes/submit] error:', updateErr.message)
    return NextResponse.json(
      { error: 'Failed to submit visit note', supabase_message: updateErr.message },
      { status: 500 }
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      action:      'visit_note.submitted',
      entity_type: 'visit_note',
      entity_id:   id,
      actor:       'admin',
      metadata:    { submitted_at: now },
    })
  } catch { /* non-critical */ }

  return NextResponse.json(note)
}
