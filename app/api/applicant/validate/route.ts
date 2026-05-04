import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    )
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')

  const { data: applicant, error } = await adminClient
    .from('applicants')
    .select(`
      id,
      company_id,
      email,
      first_name,
      last_name,
      phone,
      job_role,
      status,
      token_expires_at,
      created_at
    `)
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    console.error('[validate-applicant-token] lookup failed:', error)
    return NextResponse.json(
      { error: 'Could not validate token' },
      { status: 500 }
    )
  }

  if (!applicant) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    )
  }

  if (!applicant.token_expires_at) {
    return NextResponse.json(
      { error: 'Token has no expiry date' },
      { status: 401 }
    )
  }

  if (new Date(applicant.token_expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'Token has expired' },
      { status: 410 }
    )
  }

  if (applicant.status === 'hired') {
    return NextResponse.json(
      { error: 'Applicant has already been hired' },
      { status: 409 }
    )
  }

  if (applicant.status === 'withdrawn') {
    return NextResponse.json(
      { error: 'Application has been withdrawn' },
      { status: 409 }
    )
  }

  return NextResponse.json(
    {
      applicant: {
        id:         applicant.id,
        company_id: applicant.company_id,
        email:      applicant.email,
        first_name: applicant.first_name,
        last_name:  applicant.last_name,
        phone:      applicant.phone,
        job_role:   applicant.job_role,
        status:     applicant.status,
        created_at: applicant.created_at,
      },
    },
    { status: 200 }
  )
}
