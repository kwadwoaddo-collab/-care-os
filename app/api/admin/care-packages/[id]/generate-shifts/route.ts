import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ── POST /api/admin/care-packages/[id]/generate-shifts ────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  // Fetch care package + visits
  const { data: pkg, error: pkgErr } = await adminClient
    .from('care_packages')
    .select(`
      id, client_id, company_id, title, status, start_date, end_date,
      care_package_visits ( id, day_of_week, start_time, end_time, shift_type )
    `)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (pkgErr || !pkg) {
    return NextResponse.json({ error: 'Care package not found' }, { status: 404 })
  }

  if (pkg.status !== 'active') {
    return NextResponse.json(
      { error: 'Only active care packages can generate shifts' },
      { status: 422 }
    )
  }

  const visits = (pkg.care_package_visits ?? []) as {
    id: string
    day_of_week: number
    start_time: string
    end_time: string
    shift_type: string | null
  }[]

  if (visits.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0, message: 'No visits defined on this package' })
  }

  // Fetch existing shifts for this package (to detect duplicates)
  const { data: existing } = await adminClient
    .from('shifts')
    .select('shift_date, start_time')
    .eq('care_package_id', id)

  const existingKeys = new Set<string>(
    (existing ?? []).map((s) => {
      const row = s as { shift_date: string; start_time: string }
      return `${row.shift_date}|${row.start_time}`
    })
  )

  // Build shifts for next 14 days
  const today = new Date()
  const toInsert: {
    company_id:      string
    client_id:       string
    care_package_id: string
    title:           string
    shift_date:      string
    start_time:      string
    end_time:        string
    shift_type:      string | null
    status:          string
    created_by:      string
  }[] = []

  let skipped = 0

  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + i
    ))
    const dayOfWeek = d.getUTCDay()
    const dateStr   = d.toISOString().slice(0, 10)

    for (const visit of visits) {
      if (visit.day_of_week !== dayOfWeek) continue

      const key = `${dateStr}|${visit.start_time}`
      if (existingKeys.has(key)) {
        skipped++
        continue
      }

      existingKeys.add(key)
      toInsert.push({
        company_id:      pkg.company_id as string,
        client_id:       pkg.client_id  as string,
        care_package_id: id,
        title:           `${pkg.title as string} — ${DAYS[dayOfWeek]}`,
        shift_date:      dateStr,
        start_time:      visit.start_time,
        end_time:        visit.end_time,
        shift_type:      visit.shift_type,
        status:          'scheduled',
        created_by:      'care_package',
      })
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, skipped, message: 'All shifts already exist for the next 14 days' })
  }

  const { error: insertErr } = await adminClient.from('shifts').insert(toInsert)

  if (insertErr) {
    console.error('[care-packages/generate-shifts] insert error:', insertErr.message)
    return NextResponse.json(
      { error: 'Failed to insert shifts', supabase_message: insertErr.message },
      { status: 500 }
    )
  }

  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'care_package.shifts_generated',
      entity_type: 'care_package',
      entity_id:   id,
      metadata:    { created: toInsert.length },
    })
  } catch { /* non-critical */ }

  return NextResponse.json({ created: toInsert.length, skipped })
}
