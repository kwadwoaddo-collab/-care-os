import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import { forbidden }                 from '@/lib/auth/responses'
import { ipRateLimit }               from '@/lib/rateLimit'
import type { QueueItem, QueuePriority, QueueCategory } from '@/lib/operations/priorityQueue'

const PRIORITIES: QueuePriority[] = ['critical', 'urgent', 'warning', 'informational']
const CATEGORIES: QueueCategory[] = [
  'safeguarding', 'compliance', 'staffing', 'onboarding',
  'incident', 'medication', 'shift_coverage', 'other',
]
const STATUSES = ['open', 'in_progress', 'resolved', 'dismissed'] as const

// ── GET /api/admin/operations/queue ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const sp       = request.nextUrl.searchParams
  const priority = sp.get('priority')
  const category = sp.get('category')
  const status   = sp.get('status') ?? 'open'
  const page     = Math.max(1, parseInt(sp.get('page') ?? '1'))
  const pageSize = Math.min(50, parseInt(sp.get('pageSize') ?? '25'))
  const from     = (page - 1) * pageSize
  const to       = from + pageSize - 1

  let q = adminClient
    .from('operations_queue')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)

  if (status && STATUSES.includes(status as typeof STATUSES[number])) {
    q = q.eq('status', status)
  }
  if (priority && PRIORITIES.includes(priority as QueuePriority)) {
    q = q.eq('priority', priority)
  }
  if (category && CATEGORIES.includes(category as QueueCategory)) {
    q = q.eq('category', category)
  }

  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[ops-queue] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
  }

  return NextResponse.json({
    data:  data as QueueItem[],
    total: count ?? 0,
    page,
    pageSize,
  })
}

// ── POST /api/admin/operations/queue ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rl = ipRateLimit(request, 'ops-queue:create', 30, 60_000)
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

  const { priority, category, title, description, entity_type, entity_id, entity_url, assigned_to, due_date } = body

  if (!title)    return NextResponse.json({ error: 'title is required' },    { status: 400 })
  if (!priority) return NextResponse.json({ error: 'priority is required' }, { status: 400 })
  if (!category) return NextResponse.json({ error: 'category is required' }, { status: 400 })

  if (!PRIORITIES.includes(priority as QueuePriority)) {
    return NextResponse.json({ error: `Invalid priority: ${String(priority)}` }, { status: 400 })
  }
  if (!CATEGORIES.includes(category as QueueCategory)) {
    return NextResponse.json({ error: `Invalid category: ${String(category)}` }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('operations_queue')
    .insert({
      company_id:     companyId,
      priority,
      category,
      title,
      description:    description ?? null,
      entity_type:    entity_type ?? null,
      entity_id:      entity_id ?? null,
      entity_url:     entity_url ?? null,
      assigned_to:    assigned_to ?? null,
      assigned_at:    assigned_to ? new Date().toISOString() : null,
      due_date:       due_date ?? null,
      status:         'open',
      auto_generated: false,
      source:         'coordinator',
    })
    .select()
    .single()

  if (error) {
    console.error('[ops-queue] POST error:', error.message)
    return NextResponse.json({ error: 'Failed to create queue item' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
