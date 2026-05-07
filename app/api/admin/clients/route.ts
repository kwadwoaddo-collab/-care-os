import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getPaginationParams, getRange, buildPaginationMeta } from '@/lib/pagination'
import { requireAdmin } from '@/lib/auth/requireAdmin'

// ── GET /api/admin/clients ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const sp          = request.nextUrl.searchParams
  const search      = sp.get('search')       ?? ''
  const status      = sp.get('status')       ?? ''
  const riskLevel   = sp.get('risk_level')   ?? ''
  const fundingType = sp.get('funding_type') ?? ''
  const { page, pageSize } = getPaginationParams(Object.fromEntries(sp.entries()))

  let query = adminClient
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (status)      query = query.eq('status',       status)
  if (riskLevel)   query = query.eq('risk_level',   riskLevel)
  if (fundingType) query = query.eq('funding_type', fundingType)
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,preferred_name.ilike.%${search}%,postcode.ilike.%${search}%,phone.ilike.%${search}%`
    )
  }

  const { from, to } = getRange(page, pageSize)
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('[admin/clients] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }

  const meta = buildPaginationMeta(count ?? 0, page, pageSize)
  return NextResponse.json({ data: data ?? [], meta })
}

// ── POST /api/admin/clients ───────────────────────────────────────────────────

interface CreateClientBody {
  company_id?:                    string
  first_name:                     string
  last_name:                      string
  preferred_name?:                string
  date_of_birth?:                 string
  phone?:                         string
  email?:                         string
  address_line_1?:                string
  address_line_2?:                string
  town_city?:                     string
  postcode?:                      string
  status?:                        string
  care_start_date?:               string
  care_end_date?:                 string
  funding_type?:                  string
  risk_level?:                    string
  emergency_contact_name?:        string
  emergency_contact_phone?:       string
  emergency_contact_relationship?: string
  notes?:                         string
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  let body: CreateClientBody
  try {
    body = await request.json() as CreateClientBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { first_name, last_name } = body

  if (!first_name || !last_name) {
    return NextResponse.json(
      { error: 'first_name and last_name are required' },
      { status: 400 }
    )
  }

  const { data: client, error: insertErr } = await adminClient
    .from('clients')
    .insert({
      company_id: companyId,
      first_name,
      last_name,
      preferred_name:                 body.preferred_name                 ?? null,
      date_of_birth:                  body.date_of_birth                  ?? null,
      phone:                          body.phone                          ?? null,
      email:                          body.email                          ?? null,
      address_line_1:                 body.address_line_1                 ?? null,
      address_line_2:                 body.address_line_2                 ?? null,
      town_city:                      body.town_city                      ?? null,
      postcode:                       body.postcode                       ?? null,
      status:                         body.status                         ?? 'active',
      care_start_date:                body.care_start_date                ?? null,
      care_end_date:                  body.care_end_date                  ?? null,
      funding_type:                   body.funding_type                   ?? null,
      risk_level:                     body.risk_level                     ?? 'standard',
      emergency_contact_name:         body.emergency_contact_name         ?? null,
      emergency_contact_phone:        body.emergency_contact_phone        ?? null,
      emergency_contact_relationship: body.emergency_contact_relationship ?? null,
      notes:                          body.notes                          ?? null,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[admin/clients] insert error:', insertErr.message)
    return NextResponse.json(
      { error: 'Failed to create client', supabase_message: insertErr.message },
      { status: 500 }
    )
  }

  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'client.created',
      entity_type: 'client',
      entity_id:   client.id,
      metadata:    { first_name, last_name },
    })
  } catch { /* non-critical */ }

  return NextResponse.json(client, { status: 201 })
}
