import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const ALLOWED_STATUSES = ['active', 'paused', 'ended', 'draft'] as const

// ── GET /api/admin/care-packages/[id] ─────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  const { data, error } = await adminClient
    .from('care_packages')
    .select(`
      *,
      clients!client_id ( id, first_name, last_name ),
      care_package_visits (
        id, day_of_week, start_time, end_time, shift_type,
        preferred_gender, requires_driver, requires_double_up, notes
      )
    `)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    console.error('[admin/care-packages/[id]] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch care package', supabase_message: error.message },
      { status: 500 }
    )
  }

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}

// ── PATCH /api/admin/care-packages/[id] ───────────────────────────────────────

interface VisitInput {
  day_of_week:        number
  start_time:         string
  end_time:           string
  shift_type?:        string
  preferred_gender?:  string
  requires_driver?:   boolean
  requires_double_up?: boolean
  notes?:             string
}

interface PatchBody {
  title?:        string
  description?:  string | null
  start_date?:   string
  end_date?:     string | null
  status?:       string
  funding_type?: string | null
  weekly_hours?: number | null
  visits?:       VisitInput[]
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  let body: PatchBody
  try {
    body = await request.json() as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.status && !ALLOWED_STATUSES.includes(body.status as typeof ALLOWED_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const pkgFields: Array<keyof Omit<PatchBody, 'visits'>> = [
    'title', 'description', 'start_date', 'end_date', 'status', 'funding_type', 'weekly_hours',
  ]

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of pkgFields) {
    if (key in body) updates[key] = body[key] ?? null
  }

  const { data: pkg, error: pkgErr } = await adminClient
    .from('care_packages')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (pkgErr) {
    console.error('[admin/care-packages/[id]] patch error:', pkgErr.message)
    return NextResponse.json(
      { error: 'Failed to update care package', supabase_message: pkgErr.message },
      { status: 500 }
    )
  }

  // Replace visits if provided
  if (body.visits !== undefined) {
    await adminClient.from('care_package_visits').delete().eq('care_package_id', id)

    if (body.visits.length > 0) {
      const visitRows = body.visits.map((v) => ({
        care_package_id:    id,
        day_of_week:        v.day_of_week,
        start_time:         v.start_time,
        end_time:           v.end_time,
        shift_type:         v.shift_type         ?? null,
        preferred_gender:   v.preferred_gender   ?? null,
        requires_driver:    v.requires_driver    ?? false,
        requires_double_up: v.requires_double_up ?? false,
        notes:              v.notes              ?? null,
      }))
      await adminClient.from('care_package_visits').insert(visitRows)
    }
  }

  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'care_package.updated',
      entity_type: 'care_package',
      entity_id:   id,
      metadata:    updates,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(pkg)
}
