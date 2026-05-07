import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import {
  calculateCompliance,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord } from '@/lib/staff/types'
import { calculateReadiness }      from '@/lib/staff/calculateReadiness'
import { getPaginationParams, getRange, buildPaginationMeta } from '@/lib/pagination'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

// ── GET /api/admin/shifts ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp         = request.nextUrl.searchParams
  const search     = sp.get('search')     ?? ''
  const status     = sp.get('status')     ?? ''
  const shiftType  = sp.get('shift_type') ?? ''
  const assigned   = sp.get('assigned')   ?? '' // 'assigned' | 'unassigned'
  const dateFrom   = sp.get('date_from')  ?? ''
  const dateTo     = sp.get('date_to')    ?? ''
  const { page, pageSize } = getPaginationParams(Object.fromEntries(sp.entries()))

  let query = adminClient
    .from('shifts')
    .select(`
      id, company_id, assigned_staff_id, created_by,
      title, shift_date, start_time, end_time,
      location, client_name, client_id, care_package_id, shift_type, status, notes,
      created_at, updated_at,
      staff_profiles!assigned_staff_id ( id, first_name, last_name, email ),
      clients!client_id              ( id, first_name, last_name ),
      care_packages!care_package_id  ( id, title )
    `, { count: 'exact' })
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (status)    query = query.eq('status',     status)
  if (shiftType) query = query.eq('shift_type', shiftType)
  if (dateFrom)  query = query.gte('shift_date', dateFrom)
  if (dateTo)    query = query.lte('shift_date', dateTo)
  if (assigned === 'assigned')   query = query.not('assigned_staff_id', 'is', null)
  if (assigned === 'unassigned') query = query.is('assigned_staff_id', null)
  if (search) {
    query = query.or(
      `title.ilike.%${search}%,location.ilike.%${search}%,client_name.ilike.%${search}%`
    )
  }

  const { from, to } = getRange(page, pageSize)
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('[admin/shifts] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }

  const shifts = data ?? []

  // Attach timesheet status for the current page only
  let timesheetStatusByShift: Record<string, string> = {}
  if (shifts.length > 0) {
    const shiftIds = shifts.map((s) => s.id)
    const { data: ts } = await adminClient
      .from('timesheets')
      .select('shift_id, status')
      .in('shift_id', shiftIds)
    for (const row of ts ?? []) {
      const r = row as { shift_id: string; status: string }
      timesheetStatusByShift[r.shift_id] = r.status
    }
  }

  const pageData = shifts.map((s) => ({
    ...s,
    timesheet_status: timesheetStatusByShift[s.id] ?? null,
  }))

  const meta = buildPaginationMeta(count ?? pageData.length, page, pageSize)
  return NextResponse.json({ data: pageData, meta })
}

// ── POST /api/admin/shifts ────────────────────────────────────────────────────

interface CreateShiftBody {
  assigned_staff_id: string | null
  title:             string
  shift_date:        string
  start_time:        string
  end_time:          string
  location?:          string
  client_name?:       string
  client_id?:         string
  care_package_id?:   string
  shift_type?:        string
  notes?:             string
}

export async function POST(request: NextRequest) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateShiftBody
  try {
    body = await request.json() as CreateShiftBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { assigned_staff_id, title, shift_date, start_time, end_time } = body

  if (!title || !shift_date || !start_time || !end_time) {
    return NextResponse.json(
      { error: 'title, shift_date, start_time, end_time are required' },
      { status: 400 }
    )
  }

  // end_time <= start_time is intentionally allowed — it means the shift ends the
  // following day (e.g. 20:00 → 08:00).  No schema change needed; callers that
  // need to compute duration must account for the date boundary themselves.
  const is_overnight = end_time <= start_time

  // ── Resolve company_id ─────────────────────────────────────────────────────
  // Never trust a string literal from the client — always derive a real UUID.
  let company_id: string

  // ── Validate assigned staff ────────────────────────────────────────────────
  if (assigned_staff_id) {
    const { data: staff, error: staffErr } = await adminClient
      .from('staff_profiles')
      .select('id, company_id, status, applicant_id')
      .eq('id', assigned_staff_id)
      .maybeSingle()

    if (staffErr || !staff) {
      return NextResponse.json({ error: 'Assigned staff not found' }, { status: 404 })
    }

    company_id = staff.company_id as string

    if (staff.status !== 'active') {
      return NextResponse.json(
        { error: 'Assigned staff must be active to receive a shift' },
        { status: 422 }
      )
    }

    // Check readiness
    let docs: ComplianceDocument[] = []
    if (staff.applicant_id) {
      const { data: applicantDocs } = await adminClient
        .from('documents')
        .select('id, document_type, file_name, expiry_date')
        .eq('applicant_id', staff.applicant_id)
      if (applicantDocs) docs = applicantDocs as ComplianceDocument[]
    }
    const { data: staffDocs } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date')
      .eq('staff_profile_id', assigned_staff_id)
    if (staffDocs) docs.push(...(staffDocs as ComplianceDocument[]))

    const compliance = calculateCompliance(docs)

    const { data: availRaw } = await adminClient
      .from('staff_availability')
      .select('*')
      .eq('staff_profile_id', assigned_staff_id)
      .maybeSingle()

    const availability = availRaw
      ? parseAvailabilityRecord(assigned_staff_id, availRaw as Record<string, unknown>)
      : null

    const readiness = calculateReadiness(staff.status, compliance.compliant, availability)

    if (!readiness.ready) {
      return NextResponse.json(
        {
          error:    'Staff is not ready to be assigned — resolve compliance or availability issues first',
          blockers: readiness.blockers,
          warnings: readiness.warnings,
        },
        { status: 422 }
      )
    }

  } else {
    // No staff assigned — fall back to the first company in the table.
    const { data: company, error: companyErr } = await adminClient
      .from('companies')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (companyErr || !company) {
      console.error('[admin/shifts] no company found:', companyErr?.message)
      return NextResponse.json(
        { error: 'No company found for shift creation' },
        { status: 500 }
      )
    }

    company_id = company.id as string
  }

  // ── Insert shift ───────────────────────────────────────────────────────────
  const { data: shift, error: insertErr } = await adminClient
    .from('shifts')
    .insert({
      company_id,
      assigned_staff_id: assigned_staff_id ?? null,
      created_by:  'admin',
      title,
      shift_date,
      start_time,
      end_time,
      location:         body.location         ?? null,
      client_name:      body.client_name      ?? null,
      client_id:        body.client_id        ?? null,
      care_package_id:  body.care_package_id  ?? null,
      shift_type:       body.shift_type       ?? null,
      notes:       body.notes       ?? null,
      status:      'scheduled',
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[admin/shifts] insert error:', insertErr.message)
    return NextResponse.json(
      { error: 'Failed to create shift', supabase_message: insertErr.message },
      { status: 500 }
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      action:      'shift.created',
      entity_type: 'shift',
      entity_id:   shift.id,
      actor:       'admin',
      metadata:    { title, shift_date, assigned_staff_id, is_overnight },
    })
  } catch { /* non-critical */ }

  return NextResponse.json(shift, { status: 201 })
}
