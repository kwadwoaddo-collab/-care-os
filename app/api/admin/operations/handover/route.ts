import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import { forbidden }                 from '@/lib/auth/responses'
import { ipRateLimit }               from '@/lib/rateLimit'
import type { HandoverNote }         from '@/lib/operations/priorityQueue'

// ── GET /api/admin/operations/handover ────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const sp       = request.nextUrl.searchParams
  const limit    = Math.min(20, parseInt(sp.get('limit') ?? '10'))
  const dateFrom = sp.get('date_from')

  let q = adminClient
    .from('handover_notes')
    .select('*')
    .eq('company_id', companyId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (dateFrom) {
    q = q.gte('handover_date', dateFrom)
  }

  const { data, error } = await q

  if (error) {
    console.error('[handover] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch handover notes' }, { status: 500 })
  }

  return NextResponse.json({ data: data as HandoverNote[] })
}

// ── POST /api/admin/operations/handover ───────────────────────────────────────

export async function POST(request: NextRequest) {
  const rl = ipRateLimit(request, 'handover:create', 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:write')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { author_name, summary, shift_period, handover_date, flagged_items, follow_up_actions } = body

  if (!author_name) return NextResponse.json({ error: 'author_name is required' }, { status: 400 })
  if (!summary)     return NextResponse.json({ error: 'summary is required' },     { status: 400 })

  const PERIODS = ['morning', 'afternoon', 'evening', 'night', 'day']
  if (shift_period && !PERIODS.includes(shift_period as string)) {
    return NextResponse.json({ error: `Invalid shift_period: ${String(shift_period)}` }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('handover_notes')
    .insert({
      company_id:        companyId,
      handover_date:     handover_date ?? new Date().toISOString().slice(0, 10),
      shift_period:      shift_period ?? 'day',
      author_name,
      summary,
      flagged_items:     flagged_items ?? [],
      follow_up_actions: follow_up_actions ?? [],
      status:            'active',
    })
    .select()
    .single()

  if (error) {
    console.error('[handover] POST error:', error.message)
    return NextResponse.json({ error: 'Failed to create handover note' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
