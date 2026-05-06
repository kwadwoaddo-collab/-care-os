import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

// ── GET /api/admin/clients ────────────────────────────────────────────────────

export async function GET() {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await adminClient
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/clients] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch clients', supabase_message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
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
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // Resolve company_id — use provided value or fall back to first company
  let company_id = body.company_id
  if (!company_id) {
    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (companyErr || !company) {
      console.error('[admin/clients] no company found:', companyErr?.message)
      return NextResponse.json({ error: 'No company found' }, { status: 500 })
    }
    company_id = company.id as string
  }

  const { data: client, error: insertErr } = await adminClient
    .from('clients')
    .insert({
      company_id,
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
      action:      'client.created',
      entity_type: 'client',
      entity_id:   client.id,
      actor:       'admin',
      metadata:    { first_name, last_name },
    })
  } catch { /* non-critical */ }

  return NextResponse.json(client, { status: 201 })
}
