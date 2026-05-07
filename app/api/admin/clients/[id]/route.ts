import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const ALLOWED_STATUSES    = ['active', 'paused', 'ended', 'prospective'] as const
const ALLOWED_FUNDING     = ['private', 'local_authority', 'nhs', 'direct_payment', 'other'] as const
const ALLOWED_RISK_LEVELS = ['low', 'standard', 'high', 'critical'] as const

// ── GET /api/admin/clients/[id] ───────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  const { data, error } = await adminClient
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    console.error('[admin/clients/[id]] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch client', supabase_message: error.message },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// ── PATCH /api/admin/clients/[id] ─────────────────────────────────────────────

interface PatchBody {
  first_name?:                    string
  last_name?:                     string
  preferred_name?:                string | null
  date_of_birth?:                 string | null
  phone?:                         string | null
  email?:                         string | null
  address_line_1?:                string | null
  address_line_2?:                string | null
  town_city?:                     string | null
  postcode?:                      string | null
  status?:                        string
  care_start_date?:               string | null
  care_end_date?:                 string | null
  funding_type?:                  string | null
  risk_level?:                    string
  emergency_contact_name?:        string | null
  emergency_contact_phone?:       string | null
  emergency_contact_relationship?: string | null
  notes?:                         string | null
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

  if (body.funding_type && !ALLOWED_FUNDING.includes(body.funding_type as typeof ALLOWED_FUNDING[number])) {
    return NextResponse.json(
      { error: `Invalid funding_type. Allowed: ${ALLOWED_FUNDING.join(', ')}` },
      { status: 400 }
    )
  }

  if (body.risk_level && !ALLOWED_RISK_LEVELS.includes(body.risk_level as typeof ALLOWED_RISK_LEVELS[number])) {
    return NextResponse.json(
      { error: `Invalid risk_level. Allowed: ${ALLOWED_RISK_LEVELS.join(', ')}` },
      { status: 400 }
    )
  }

  const allowed: Array<keyof PatchBody> = [
    'first_name', 'last_name', 'preferred_name', 'date_of_birth',
    'phone', 'email', 'address_line_1', 'address_line_2', 'town_city', 'postcode',
    'status', 'care_start_date', 'care_end_date', 'funding_type', 'risk_level',
    'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
    'notes',
  ]

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null
  }

  const { data: client, error } = await adminClient
    .from('clients')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    console.error('[admin/clients/[id]] patch error:', error.message)
    return NextResponse.json(
      { error: 'Failed to update client', supabase_message: error.message },
      { status: 500 }
    )
  }

  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'client.updated',
      entity_type: 'client',
      entity_id:   id,
      metadata:    updates,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(client)
}
