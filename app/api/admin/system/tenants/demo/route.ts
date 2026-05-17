import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// POST /api/admin/system/tenants/demo
// Body: { company_id: string }
// Generates a demo data set for a tenant (applicants + staff in pre_employment).
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'tenants:write')) return forbidden('Tenant administration requires super_admin')

  const body = await req.json()
  const companyId = body.company_id as string | undefined

  if (!companyId) {
    return NextResponse.json({ error: 'company_id required' }, { status: 400 })
  }

  const { data: company } = await adminClient
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .maybeSingle()

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const DEMO = '[DEMO]'
  const results: string[] = []

  function isoOffset(days: number) {
    return new Date(Date.now() + days * 86400_000).toISOString()
  }
  function dateOffset(days: number) {
    return isoOffset(days).slice(0, 10)
  }

  // 1. Demo applicants
  const applicants = [
    { company_id: companyId, first_name: DEMO, last_name: 'Aisha Mensah',    email: 'demo.aisha@care-os.test',   status: 'applied',              applied_at: isoOffset(-5)  },
    { company_id: companyId, first_name: DEMO, last_name: 'Brian Okonkwo',   email: 'demo.brian@care-os.test',   status: 'shortlisted',          applied_at: isoOffset(-10) },
    { company_id: companyId, first_name: DEMO, last_name: 'Chloe Fernandez', email: 'demo.chloe@care-os.test',   status: 'interview_scheduled',  applied_at: isoOffset(-15) },
  ]
  const { error: appErr } = await adminClient.from('applicants').insert(applicants)
  if (appErr) return NextResponse.json({ error: `Applicants: ${appErr.message}` }, { status: 500 })
  results.push(`Created ${applicants.length} demo applicants`)

  // 2. Demo staff profiles
  const staff = [
    { company_id: companyId, first_name: DEMO, last_name: 'Diana Park',    email: 'demo.diana@care-os.test',  status: 'active',         job_role: 'Care Worker',   start_date: dateOffset(-90) },
    { company_id: companyId, first_name: DEMO, last_name: 'Elton Asante',  email: 'demo.elton@care-os.test',  status: 'active',         job_role: 'Senior Carer',  start_date: dateOffset(-180) },
    { company_id: companyId, first_name: DEMO, last_name: 'Faith Osei',    email: 'demo.faith@care-os.test',  status: 'pre_employment', job_role: 'Care Worker',   start_date: null },
    { company_id: companyId, first_name: DEMO, last_name: 'George Baffoe', email: 'demo.george@care-os.test', status: 'pre_employment', job_role: 'Support Worker', start_date: null },
  ]
  const { error: staffErr } = await adminClient.from('staff_profiles').insert(staff)
  if (staffErr) return NextResponse.json({ error: `Staff: ${staffErr.message}` }, { status: 500 })
  results.push(`Created ${staff.length} demo staff profiles`)

  // 3. Demo clients
  const clients = [
    { company_id: companyId, first_name: DEMO, last_name: 'Harold Kent',   status: 'active',      risk_level: 'standard', funding_type: 'local_authority', care_start_date: dateOffset(-60) },
    { company_id: companyId, first_name: DEMO, last_name: 'Irene Watkins', status: 'active',      risk_level: 'high',     funding_type: 'nhs',             care_start_date: dateOffset(-30) },
    { company_id: companyId, first_name: DEMO, last_name: 'James Addo',    status: 'prospective', risk_level: 'low',      funding_type: 'private',         care_start_date: null },
  ]
  const { error: clientErr } = await adminClient.from('clients').insert(clients)
  if (clientErr) return NextResponse.json({ error: `Clients: ${clientErr.message}` }, { status: 500 })
  results.push(`Created ${clients.length} demo clients`)

  return NextResponse.json({ ok: true, results })
}
