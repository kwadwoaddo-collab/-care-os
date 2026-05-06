import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

const ALLOWED_OUTCOMES = ['pending', 'recommend_hire', 'hold', 'reject'] as const
type AllowedOutcome = (typeof ALLOWED_OUTCOMES)[number]

function isAllowedOutcome(v: unknown): v is AllowedOutcome {
  return typeof v === 'string' && (ALLOWED_OUTCOMES as readonly string[]).includes(v)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { notes, score, outcome } = body
  const errors: string[] = []

  // Validate score
  if (score !== undefined && score !== null) {
    const n = Number(score)
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      errors.push('score must be an integer between 1 and 10')
    }
  }

  // Validate outcome
  if (outcome !== undefined && !isAllowedOutcome(outcome)) {
    errors.push(`outcome must be one of: ${ALLOWED_OUTCOMES.join(', ')}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 })
  }

  // ── Fetch existing interview to detect outcome change ──────────────────────
  const { data: existing } = await adminClient
    .from('interviews')
    .select('id, outcome, applicant_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
  }

  // ── Build update payload (only include provided fields) ────────────────────
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (notes !== undefined)   patch.notes   = notes
  if (score !== undefined)   patch.score   = score === null ? null : Number(score)
  if (outcome !== undefined) patch.outcome = outcome

  console.log('[admin/interviews/[id]] patch payload:', patch)

  const { data: interview, error: updateError } = await adminClient
    .from('interviews')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError || !interview) {
    console.error('[admin/interviews/[id]] update failed — code:', updateError?.code)
    console.error('[admin/interviews/[id]] update failed — message:', updateError?.message)
    console.error('[admin/interviews/[id]] update failed — details:', updateError?.details)
    console.error('[admin/interviews/[id]] update failed — hint:', updateError?.hint)
    return NextResponse.json(
      {
        error: 'Failed to update interview',
        supabase_code:    updateError?.code    ?? null,
        supabase_message: updateError?.message ?? null,
        supabase_details: updateError?.details ?? null,
        supabase_hint:    updateError?.hint    ?? null,
      },
      { status: 500 }
    )
  }

  // ── Fetch company_id for audit log ────────────────────────────────────────
  const { data: applicant } = await adminClient
    .from('applicants')
    .select('company_id')
    .eq('id', existing.applicant_id)
    .maybeSingle()

  // ── Audit log (fire-and-forget) ────────────────────────────────────────────
  void (async () => {
    try {
      const outcomeChanged =
        outcome !== undefined && outcome !== existing.outcome

      const auditEntries = [
        {
          company_id:  (applicant?.company_id ?? null) as string | null,
          actor_id:    null,
          action:      'interview.updated',
          entity_type: 'interview',
          entity_id:   id,
          metadata: {
            fields_updated: Object.keys(patch).filter((k) => k !== 'updated_at'),
            timestamp:      new Date().toISOString(),
          },
        },
        ...(outcomeChanged
          ? [
              {
                company_id:  (applicant?.company_id ?? null) as string | null,
                actor_id:    null,
                action:      'interview.outcome_changed',
                entity_type: 'interview',
                entity_id:   id,
                metadata: {
                  previous_outcome: existing.outcome,
                  new_outcome:      outcome,
                  timestamp:        new Date().toISOString(),
                },
              },
            ]
          : []),
      ]

      const { error } = await adminClient.from('audit_logs').insert(auditEntries)
      if (error) console.error('[admin/interviews/[id]] audit log failed:', error)
    } catch (err) {
      console.error('[admin/interviews/[id]] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ interview })
}
