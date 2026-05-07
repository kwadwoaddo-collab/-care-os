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
    .select('id, status, company_id, shift_id, client_id, staff_profile_id, incident_reported, incident_notes')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Visit note not found' }, { status: 404 })
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: `Visit note is already ${existing.status as string}` },
      { status: 409 },
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
      { status: 500 },
    )
  }

  // ── Auto-create incident from visit note ────────────────────────────────────
  if (existing.incident_reported) {
    try {
      // Only create if one doesn't already exist for this visit note
      const { data: existingIncident } = await adminClient
        .from('incidents')
        .select('id')
        .eq('visit_note_id', id)
        .maybeSingle()

      if (!existingIncident) {
        // Try to derive occurred_at from the linked shift
        let occurredAt = now
        if (existing.shift_id) {
          const { data: shift } = await adminClient
            .from('shifts')
            .select('shift_date, start_time')
            .eq('id', existing.shift_id)
            .maybeSingle()
          if (shift) {
            occurredAt = `${shift.shift_date as string}T${shift.start_time as string}`
          }
        }

        const { data: incident } = await adminClient
          .from('incidents')
          .insert({
            company_id:       existing.company_id,
            visit_note_id:    id,
            shift_id:         existing.shift_id ?? null,
            client_id:        existing.client_id ?? null,
            staff_profile_id: existing.staff_profile_id ?? null,
            incident_type:    'other',
            severity:         'medium',
            status:           'open',
            occurred_at:      occurredAt,
            description:      (existing.incident_notes as string) || 'Incident reported via visit note',
          })
          .select('id')
          .single()

        if (incident) {
          await adminClient.from('audit_logs').insert({
            action:      'incident.created_from_visit_note',
            entity_type: 'incident',
            entity_id:   incident.id,
            actor:       'system',
            metadata:    { visit_note_id: id, shift_id: existing.shift_id },
          })
        }
      }
    } catch (err) {
      // Non-critical — log but don't fail the submission
      console.error('[visit-notes/submit] incident creation error:', err)
    }
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

