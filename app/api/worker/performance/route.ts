import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker

  const thirtyDaysAgo = daysAgo(30)
  const today         = new Date().toISOString().slice(0, 10)

  const [shiftsRes, visitNotesRes, docsRes, workerRes, ackShiftsRes] = await Promise.all([
    adminClient
      .from('shifts')
      .select('id, status, shift_date')
      .eq('assigned_staff_id', staffProfileId)
      .eq('company_id', companyId)
      .gte('shift_date', thirtyDaysAgo)
      .not('status', 'eq', 'cancelled'),

    adminClient
      .from('visit_notes')
      .select('id, submitted_at')
      .eq('staff_profile_id', staffProfileId)
      .eq('company_id', companyId)
      .gte('submitted_at', `${thirtyDaysAgo}T00:00:00.000Z`),

    adminClient
      .from('documents')
      .select('id, status, expiry_date')
      .eq('staff_profile_id', staffProfileId)
      .eq('company_id', companyId),

    adminClient
      .from('staff_profiles')
      .select('onboarding_completed, onboarding_progress')
      .eq('id', staffProfileId)
      .maybeSingle(),

    adminClient
      .from('shifts')
      .select('id, title, shift_date, worker_ack_status')
      .eq('assigned_staff_id', staffProfileId)
      .eq('company_id', companyId)
      .gte('shift_date', thirtyDaysAgo)
      .not('worker_ack_status', 'is', null)
      .order('shift_date', { ascending: false })
      .limit(15),
  ])

  const shifts     = shiftsRes.data ?? []
  const notes      = visitNotesRes.data ?? []
  const docs       = docsRes.data ?? []
  const worker     = workerRes.data
  const ackShifts  = ackShiftsRes.data ?? []

  const completedShifts = shifts.filter(s => s.status === 'completed')
  const missedShifts    = shifts.filter(s => s.status === 'missed')
  const attendanceRate  = shifts.length > 0
    ? Math.round((completedShifts.length / shifts.length) * 100)
    : 100

  const totalDocs    = docs.length
  const approvedDocs = docs.filter(d => d.status === 'approved').length
  const expiredDocs  = docs.filter(d => d.expiry_date && d.expiry_date < today).length
  const complianceScore = totalDocs > 0 ? Math.round((approvedDocs / totalDocs) * 100) : 0

  return NextResponse.json({
    attendance: {
      rate:             attendanceRate,
      completed_shifts: completedShifts.length,
      total_shifts:     shifts.length,
      missed_shifts:    missedShifts.length,
    },
    visits: {
      submitted_notes: notes.filter(n => n.submitted_at).length,
    },
    compliance: {
      score:         complianceScore,
      total_docs:    totalDocs,
      approved_docs: approvedDocs,
      expired_docs:  expiredDocs,
    },
    onboarding: {
      completed: worker?.onboarding_completed ?? false,
      progress:  worker?.onboarding_progress  ?? 0,
    },
    acknowledgements: ackShifts,
  })
}
