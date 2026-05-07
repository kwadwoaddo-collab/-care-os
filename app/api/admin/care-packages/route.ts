import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

// ── GET /api/admin/care-packages ──────────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { data, error } = await adminClient
    .from('care_packages')
    .select(`
      id, company_id, client_id, title, description,
      start_date, end_date, status, funding_type, weekly_hours,
      created_at, updated_at,
      clients!client_id ( id, first_name, last_name ),
      care_package_visits ( id, day_of_week, start_time, end_time, shift_type,
        requires_driver, requires_double_up, notes )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/care-packages] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch care packages', supabase_message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}

// ── POST /api/admin/care-packages ─────────────────────────────────────────────

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

interface CreateCarePackageBody {
  company_id?:   string
  client_id:     string
  title:         string
  description?:  string
  start_date:    string
  end_date?:     string
  status?:       string
  funding_type?: string
  weekly_hours?: number
  visits?:       VisitInput[]
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  let body: CreateCarePackageBody
  try {
    body = await request.json() as CreateCarePackageBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { client_id, title, start_date } = body
  if (!client_id || !title || !start_date) {
    return NextResponse.json(
      { error: 'client_id, title, and start_date are required' },
      { status: 400 }
    )
  }

  // Resolve company_id
  let company_id = body.company_id
  if (!company_id) {
    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id')
      .limit(1)
      .maybeSingle()
    if (companyErr || !company) {
      return NextResponse.json({ error: 'No company found' }, { status: 500 })
    }
    company_id = company.id as string
  }

  // Insert care package
  const { data: pkg, error: pkgErr } = await adminClient
    .from('care_packages')
    .insert({
      company_id,
      client_id,
      title,
      description:  body.description  ?? null,
      start_date,
      end_date:     body.end_date     ?? null,
      status:       body.status       ?? 'active',
      funding_type: body.funding_type ?? null,
      weekly_hours: body.weekly_hours ?? null,
    })
    .select()
    .single()

  if (pkgErr) {
    console.error('[admin/care-packages] insert error:', pkgErr.message)
    return NextResponse.json(
      { error: 'Failed to create care package', supabase_message: pkgErr.message },
      { status: 500 }
    )
  }

  // Insert visits
  if (body.visits && body.visits.length > 0) {
    const visitRows = body.visits.map((v) => ({
      care_package_id:    pkg.id,
      day_of_week:        v.day_of_week,
      start_time:         v.start_time,
      end_time:           v.end_time,
      shift_type:         v.shift_type         ?? null,
      preferred_gender:   v.preferred_gender   ?? null,
      requires_driver:    v.requires_driver    ?? false,
      requires_double_up: v.requires_double_up ?? false,
      notes:              v.notes              ?? null,
    }))

    const { error: visitsErr } = await adminClient
      .from('care_package_visits')
      .insert(visitRows)

    if (visitsErr) {
      console.error('[admin/care-packages] visits insert error:', visitsErr.message)
    }
  }

  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'care_package.created',
      entity_type: 'care_package',
      entity_id:   pkg.id,
      metadata:    { title, client_id, visit_count: body.visits?.length ?? 0 },
    })
  } catch { /* non-critical */ }

  // Return package with visits
  const { data: full } = await adminClient
    .from('care_packages')
    .select(`*, care_package_visits (*)`)
    .eq('id', pkg.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}
