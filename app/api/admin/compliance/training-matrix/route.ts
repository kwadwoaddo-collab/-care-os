import { NextRequest, NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'

// ── UK mandatory training categories for domiciliary care ─────────────────────

export const UK_MANDATORY_CATEGORIES = [
  'fire_safety',
  'moving_and_handling',
  'first_aid',
  'safeguarding_adults',
  'safeguarding_children',
  'infection_control',
  'medication',
  'mental_capacity',
  'food_hygiene',
  'health_and_safety',
  'lone_working',
  'dementia_awareness',
  'communication',
] as const

export type TrainingStatus = 'complete' | 'expiring' | 'expired' | 'missing'

// ── Public types ──────────────────────────────────────────────────────────────

export interface TrainingMatrixStaff {
  id:        string
  name:      string
  jobRole:   string | null
  email:     string | null
  /** compliance % across all training categories */
  trainingPct: number
}

export interface TrainingMatrixCategory {
  key:        string
  label:      string
  isMandatory: boolean
}

export interface TrainingMatrixCell {
  status:     TrainingStatus
  expiryDate: string | null
  /** ISO date of most recent approved doc */
  lastUpdated: string | null
}

export interface TrainingMatrixResponse {
  staff:      TrainingMatrixStaff[]
  categories: TrainingMatrixCategory[]
  /** matrix[staffId][categoryKey] = cell */
  matrix:     Record<string, Record<string, TrainingMatrixCell>>
  /** gaps per category: count of staff with non-complete status */
  gapsPerCategory: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function staffName(first: string | null, last: string | null, email: string | null): string {
  return [first, last].filter(Boolean).join(' ') || email || 'Unknown'
}

function humanLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function cellStatus(docs: Array<{
  reviewed_status: string
  expiry_date: string | null
}>): TrainingMatrixCell {
  const today = new Date()
  const in30  = new Date(today)
  in30.setDate(in30.getDate() + 30)

  // Only approved docs count
  const approved = docs.filter((d) => d.reviewed_status === 'approved')

  if (approved.length === 0) {
    return { status: 'missing', expiryDate: null, lastUpdated: null }
  }

  // Find the "best" approved doc — one that is not expired (or furthest expiry)
  let bestExpiry: string | null = null
  let hasExpired = false
  let hasExpiring = false
  let hasValid = false

  for (const d of approved) {
    if (!d.expiry_date) {
      // No expiry = permanent — counts as complete
      hasValid = true
      continue
    }
    const exp = new Date(d.expiry_date)
    if (exp < today) {
      hasExpired = true
      if (!bestExpiry || d.expiry_date > bestExpiry) bestExpiry = d.expiry_date
    } else if (exp <= in30) {
      hasExpiring = true
      if (!bestExpiry || d.expiry_date > bestExpiry) bestExpiry = d.expiry_date
    } else {
      hasValid = true
      if (!bestExpiry || d.expiry_date > bestExpiry) bestExpiry = d.expiry_date
    }
  }

  if (hasValid) {
    return { status: 'complete', expiryDate: bestExpiry, lastUpdated: null }
  }
  if (hasExpiring) {
    return { status: 'expiring', expiryDate: bestExpiry, lastUpdated: null }
  }
  if (hasExpired) {
    return { status: 'expired',  expiryDate: bestExpiry, lastUpdated: null }
  }
  // Fallback (should not reach here)
  return { status: 'missing', expiryDate: null, lastUpdated: null }
}

// ── GET /api/admin/compliance/training-matrix ─────────────────────────────────

export async function GET(_request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  // ── 1. Fetch active/pre-employment staff ──────────────────────────────────
  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status')
    .eq('company_id', companyId)
    .in('status', ['active', 'pre_employment'])
    .order('first_name', { ascending: true })

  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  if (staff.length === 0) {
    return NextResponse.json({
      staff:           [],
      categories:      UK_MANDATORY_CATEGORIES.map((k) => ({ key: k, label: humanLabel(k), isMandatory: true })),
      matrix:          {},
      gapsPerCategory: {},
    } satisfies TrainingMatrixResponse)
  }

  const staffIds = staff.map((s) => s.id)

  // ── 2. Fetch training certificate documents ───────────────────────────────
  const { data: docs, error: docsErr } = await adminClient
    .from('documents')
    .select('id, staff_profile_id, training_category, reviewed_status, expiry_date, created_at')
    .in('staff_profile_id', staffIds)
    .eq('document_type', 'training_certificate')
    .not('training_category', 'is', null)

  if (docsErr) {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }

  const allDocs = docs ?? []

  // ── 3. Collect all categories (mandatory + any extras found in data) ───────
  const extraCategories = new Set<string>()
  for (const d of allDocs) {
    if (d.training_category && !UK_MANDATORY_CATEGORIES.includes(d.training_category as never)) {
      extraCategories.add(d.training_category)
    }
  }

  const categories: TrainingMatrixCategory[] = [
    ...UK_MANDATORY_CATEGORIES.map((k) => ({ key: k, label: humanLabel(k), isMandatory: true  })),
    ...[...extraCategories].sort().map((k) => ({ key: k, label: humanLabel(k), isMandatory: false })),
  ]

  // ── 4. Group docs by [staff_profile_id][training_category] ────────────────
  type DocRow = {
    reviewed_status: string
    expiry_date: string | null
    created_at: string
  }
  const docMap: Record<string, Record<string, DocRow[]>> = {}
  for (const d of allDocs) {
    const sid = d.staff_profile_id as string
    const cat = d.training_category as string
    if (!docMap[sid]) docMap[sid] = {}
    if (!docMap[sid][cat]) docMap[sid][cat] = []
    docMap[sid][cat].push({
      reviewed_status: d.reviewed_status as string,
      expiry_date:     d.expiry_date as string | null,
      created_at:      d.created_at as string,
    })
  }

  // ── 5. Build matrix ───────────────────────────────────────────────────────
  const matrix: Record<string, Record<string, TrainingMatrixCell>> = {}
  const gapsAcc: Record<string, number> = {}

  for (const cat of categories) {
    gapsAcc[cat.key] = 0
  }

  const staffRows: TrainingMatrixStaff[] = staff.map((s) => {
    matrix[s.id] = {}
    let completeCount = 0

    for (const cat of categories) {
      const catDocs = docMap[s.id]?.[cat.key] ?? []
      const cell = cellStatus(catDocs)

      // Enrich lastUpdated from created_at
      if (catDocs.length > 0) {
        const latest = catDocs
          .map((d) => d.created_at)
          .sort()
          .reverse()[0]
        cell.lastUpdated = latest ?? null
      }

      matrix[s.id][cat.key] = cell

      if (cell.status === 'complete') completeCount++
      if (cell.status !== 'complete') gapsAcc[cat.key]++
    }

    const trainingPct =
      categories.length > 0
        ? Math.round((completeCount / categories.length) * 100)
        : 100

    return {
      id:          s.id,
      name:        staffName(s.first_name as string | null, s.last_name as string | null, s.email as string | null),
      jobRole:     (s.job_role as string | null) ?? null,
      email:       (s.email as string | null) ?? null,
      trainingPct,
    }
  })

  return NextResponse.json({
    staff:           staffRows,
    categories,
    matrix,
    gapsPerCategory: gapsAcc,
  } satisfies TrainingMatrixResponse)
}
