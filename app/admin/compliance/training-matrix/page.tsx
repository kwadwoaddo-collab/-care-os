import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { adminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { normaliseRole } from '@/lib/rbac/roles'
import { can } from '@/lib/rbac/permissions'
import { redirect } from 'next/navigation'
import TrainingMatrixClient from './TrainingMatrixClient'

export const metadata: Metadata = {
  title: 'Training Matrix | Care OS',
  description: 'Mandatory training compliance matrix across your workforce.',
}

// ── UK mandatory training categories ─────────────────────────────────────────
const UK_MANDATORY_CATEGORIES = [
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

export interface TrainingMatrixCell {
  status:      TrainingStatus
  expiryDate:  string | null
  lastUpdated: string | null
}

export interface MatrixStaff {
  id:          string
  name:        string
  jobRole:     string | null
  trainingPct: number
}

export interface MatrixCategory {
  key:         string
  label:       string
  abbr:        string
  isMandatory: boolean
}

export interface TrainingMatrixData {
  staff:           MatrixStaff[]
  categories:      MatrixCategory[]
  matrix:          Record<string, Record<string, TrainingMatrixCell>>
  gapsPerCategory: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function staffName(first: string | null, last: string | null, email: string | null): string {
  return [first, last].filter(Boolean).join(' ') || email || 'Unknown'
}

function humanLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function abbreviate(label: string): string {
  const ABBR: Record<string, string> = {
    'Fire Safety':         'Fire',
    'Moving And Handling': 'M&H',
    'First Aid':           '1st Aid',
    'Safeguarding Adults': 'Safegrd',
    'Safeguarding Children': 'Safegrd C',
    'Infection Control':   'Infect.',
    'Medication':          'Meds',
    'Mental Capacity':     'MCA',
    'Food Hygiene':        'Food',
    'Health And Safety':   'H&S',
    'Lone Working':        'Lone',
    'Dementia Awareness':  'Dementia',
    'Communication':       'Comms',
  }
  return ABBR[label] ?? (label.split(' ')[0] ?? label)
}

function cellStatus(docs: Array<{
  reviewed_status: string
  expiry_date:     string | null
}>): Pick<TrainingMatrixCell, 'status' | 'expiryDate'> {
  const today = new Date()
  const in30  = new Date(today)
  in30.setDate(in30.getDate() + 30)

  const approved = docs.filter((d) => d.reviewed_status === 'approved')

  if (approved.length === 0) return { status: 'missing', expiryDate: null }

  let bestExpiry:  string | null = null
  let hasValid    = false
  let hasExpiring = false
  let hasExpired  = false

  for (const d of approved) {
    if (!d.expiry_date) { hasValid = true; continue }
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

  if (hasValid)    return { status: 'complete',  expiryDate: bestExpiry }
  if (hasExpiring) return { status: 'expiring',  expiryDate: bestExpiry }
  if (hasExpired)  return { status: 'expired',   expiryDate: bestExpiry }
  return { status: 'missing', expiryDate: null }
}

// ── Data fetching (server-side) ────────────────────────────────────────────────

async function getMatrixData(companyId: string): Promise<TrainingMatrixData> {
  // Fetch active staff
  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role')
    .eq('company_id', companyId)
    .in('status', ['active', 'pre_employment'])
    .order('first_name', { ascending: true })

  if (staffErr || !staff || staff.length === 0) {
    const mandatoryCats = UK_MANDATORY_CATEGORIES.map((k) => {
      const label = humanLabel(k)
      return { key: k, label, abbr: abbreviate(label), isMandatory: true }
    })
    return { staff: [], categories: mandatoryCats, matrix: {}, gapsPerCategory: {} }
  }

  const staffIds = staff.map((s) => s.id as string)

  // Fetch training certificate documents
  const { data: docs } = await adminClient
    .from('documents')
    .select('staff_profile_id, training_category, reviewed_status, expiry_date, created_at')
    .in('staff_profile_id', staffIds)
    .eq('document_type', 'training_certificate')
    .not('training_category', 'is', null)

  const allDocs = docs ?? []

  // Collect extra categories
  const extraCategories = new Set<string>()
  for (const d of allDocs) {
    const cat = d.training_category as string
    if (cat && !UK_MANDATORY_CATEGORIES.includes(cat as never)) {
      extraCategories.add(cat)
    }
  }

  const categories: MatrixCategory[] = [
    ...UK_MANDATORY_CATEGORIES.map((k) => {
      const label = humanLabel(k)
      return { key: k, label, abbr: abbreviate(label), isMandatory: true }
    }),
    ...[...extraCategories].sort().map((k) => {
      const label = humanLabel(k)
      return { key: k, label, abbr: abbreviate(label), isMandatory: false }
    }),
  ]

  // Group docs: [staffId][category]
  type DocRow = { reviewed_status: string; expiry_date: string | null; created_at: string }
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

  // Build matrix
  const matrix: Record<string, Record<string, TrainingMatrixCell>> = {}
  const gapsAcc: Record<string, number> = {}
  for (const cat of categories) gapsAcc[cat.key] = 0

  const staffRows: MatrixStaff[] = staff.map((s) => {
    const sid = s.id as string
    matrix[sid] = {}
    let completeCount = 0

    for (const cat of categories) {
      const catDocs  = docMap[sid]?.[cat.key] ?? []
      const { status, expiryDate } = cellStatus(catDocs)
      const lastUpdated = catDocs.length > 0
        ? catDocs.map((d) => d.created_at).sort().reverse()[0] ?? null
        : null

      matrix[sid][cat.key] = { status, expiryDate, lastUpdated }
      if (status === 'complete') completeCount++
      else gapsAcc[cat.key]++
    }

    return {
      id:          sid,
      name:        staffName(s.first_name as string | null, s.last_name as string | null, s.email as string | null),
      jobRole:     (s.job_role as string | null) ?? null,
      trainingPct: categories.length > 0
        ? Math.round((completeCount / categories.length) * 100)
        : 100,
    }
  })

  return { staff: staffRows, categories, matrix, gapsPerCategory: gapsAcc }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TrainingMatrixPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .maybeSingle()

  const userRole  = normaliseRole((profile?.role as string | null) ?? '')
  const companyId = (profile?.company_id as string | null) ?? ''

  if (!can(userRole, 'compliance:read')) redirect('/admin')

  const data = await getMatrixData(companyId)

  return (
    <div className="space-y-4">
      {/* Mobile header */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/admin/compliance"
            className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Compliance
          </Link>
        </div>
        <h1 className="text-lg font-bold text-primary" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
          Training Matrix
        </h1>
        <p className="text-sm text-on-surface-variant">
          Mandatory training compliance across your workforce
        </p>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1 text-xs text-on-surface-variant mb-1">
            <Link href="/admin/compliance" className="hover:text-primary transition-colors">
              Compliance
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-on-surface">Training Matrix</span>
          </nav>
          <h1
            className="text-xl font-semibold text-primary tracking-tight"
            style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
          >
            Training Matrix
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Mandatory training compliance across your workforce
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-on-surface-variant animate-pulse">
            Loading training matrix…
          </div>
        }
      >
        <TrainingMatrixClient data={data} />
      </Suspense>
    </div>
  )
}
