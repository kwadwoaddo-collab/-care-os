import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

const VALID_STATUSES = ['pre_employment', 'active', 'suspended', 'inactive'] as const
type StaffStatus = (typeof VALID_STATUSES)[number]

export async function POST(request: NextRequest) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, company_id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Dev bypass: no admin profile found in database' },
      { status: 500 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { first_name, last_name, email, phone, job_role, start_date, status } = body

  const errors: string[] = []

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email: must be a valid email address')
  }
  if (!first_name || typeof first_name !== 'string' || (first_name as string).trim() === '') {
    errors.push('first_name: required')
  }
  if (!last_name || typeof last_name !== 'string' || (last_name as string).trim() === '') {
    errors.push('last_name: required')
  }
  if (!job_role || typeof job_role !== 'string' || (job_role as string).trim() === '') {
    errors.push('job_role: required')
  }
  if (status !== undefined && !VALID_STATUSES.includes(status as StaffStatus)) {
    errors.push(`status: must be one of ${VALID_STATUSES.join(', ')}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 })
  }

  const normalizedEmail = (email as string).toLowerCase().trim()

  const { data: existing } = await adminClient
    .from('staff_profiles')
    .select('id')
    .eq('company_id', profile.company_id)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A staff profile with this email already exists in your organisation' },
      { status: 409 }
    )
  }

  const resolvedStatus: StaffStatus = VALID_STATUSES.includes(status as StaffStatus)
    ? (status as StaffStatus)
    : 'pre_employment'

  const { data: created, error: insertError } = await adminClient
    .from('staff_profiles')
    .insert({
      company_id:   profile.company_id,
      applicant_id: null,
      first_name:   (first_name as string).trim(),
      last_name:    (last_name as string).trim(),
      email:        normalizedEmail,
      phone:        phone ? (phone as string).trim() : null,
      job_role:     (job_role as string).trim(),
      start_date:   start_date ? (start_date as string) : null,
      status:       resolvedStatus,
    })
    .select('id, status, created_at')
    .single()

  if (insertError || !created) {
    console.error('[staff/create] insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to create staff profile' }, { status: 500 })
  }

  // Audit log — fire-and-forget
  adminClient.from('audit_logs').insert({
    company_id:  profile.company_id,
    actor_id:    profile.id,
    action:      'staff.created_directly',
    entity_type: 'staff_profile',
    entity_id:   created.id,
    metadata: {
      email:    normalizedEmail,
      job_role: (job_role as string).trim(),
    },
  })

  return NextResponse.json(
    { id: created.id, status: created.status, created_at: created.created_at },
    { status: 201 }
  )
}
