import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// GET — worker visit guidance: client info, risks, key contacts, medication notes
export async function GET(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const token  = req.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params

  const { data: shift } = await adminClient
    .from('shifts')
    .select('id, title, shift_date, start_time, end_time, location, client_name, client_id, care_package_id, notes, assigned_staff_id, shift_type')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!shift || shift.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  // Fetch client details if linked
  let client = null
  if (shift.client_id) {
    const { data } = await adminClient
      .from('clients')
      .select('id, first_name, last_name, risk_level, funding_type, care_start_date')
      .eq('id', shift.client_id as string)
      .maybeSingle()
    client = data
  }

  // Fetch care package details if linked
  let carePackage = null
  if (shift.care_package_id) {
    const { data } = await adminClient
      .from('care_packages')
      .select('id, title, weekly_hours, start_date, status')
      .eq('id', shift.care_package_id as string)
      .maybeSingle()
    carePackage = data
  }

  // Fetch open safeguarding incidents for this client
  let safeguardingAlerts: unknown[] = []
  if (shift.client_id) {
    const { data } = await adminClient
      .from('incidents')
      .select('id, incident_type, severity, occurred_at, description')
      .eq('company_id', companyId)
      .eq('client_id', shift.client_id as string)
      .in('severity', ['critical', 'high'])
      .in('status', ['open', 'investigating'])
      .order('occurred_at', { ascending: false })
      .limit(3)
    safeguardingAlerts = data ?? []
  }

  // Fetch medication records from most recent visit for this client
  let medicationNotes: unknown[] = []
  if (shift.client_id) {
    const { data: recentNotes } = await adminClient
      .from('visit_notes')
      .select('id')
      .eq('company_id', companyId)
      .eq('client_id', shift.client_id as string)
      .neq('shift_id', shiftId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(1)

    if (recentNotes && recentNotes.length > 0) {
      const { data: meds } = await adminClient
        .from('visit_medication_records')
        .select('medication_name, dose, route, action, notes')
        .eq('visit_note_id', recentNotes[0].id)
        .limit(10)
      medicationNotes = meds ?? []
    }
  }

  // Build escalation contacts from admin profiles
  const { data: admins } = await adminClient
    .from('profiles')
    .select('first_name, last_name, email, role')
    .eq('company_id', companyId)
    .in('role', ['registered_manager', 'company_admin', 'coordinator'])
    .limit(3)

  const escalationContacts = (admins ?? []).map(a => ({
    name: `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim(),
    role: (a.role as string).replace(/_/g, ' '),
    email: a.email as string,
  }))

  return NextResponse.json({
    shift: {
      id:         shift.id,
      title:      shift.title,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time:   shift.end_time,
      location:   shift.location,
      shift_type: shift.shift_type,
      notes:      shift.notes,
    },
    client,
    care_package:        carePackage,
    safeguarding_alerts: safeguardingAlerts,
    medication_notes:    medicationNotes,
    escalation_contacts: escalationContacts,
  })
}
