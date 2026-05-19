import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient } from '@/lib/supabase/admin'

// System folder slugs that cannot be created or overwritten
const SYSTEM_SLUGS = new Set([
  'id-right-to-work', 'dbs-safeguarding', 'application-form-cv',
  'references-interview', 'contracts-agreements', 'training-certs',
  'shadowing-spot-checks', 'supervision-appraisal', 'health-vaccination',
  'leave-absence', 'archive',
])

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

// ── GET /api/admin/documents/folders ─────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { data, error } = await adminClient
    .from('staff_document_folders')
    .select('id, name, slug, sort_order, icon, colour, description, is_system, is_custom, archived_at, created_by')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folders: data ?? [] })
}

// ── POST /api/admin/documents/folders ─────────────────────────────────────────

const CreateSchema = z.object({
  name:        z.string().min(2).max(80),
  icon:        z.string().max(40).optional(),
  colour:      z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(200).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

  const body   = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const { name, icon, colour, description } = parsed.data
  const slug = slugify(name)

  if (SYSTEM_SLUGS.has(slug)) {
    return NextResponse.json({ error: 'Folder name conflicts with a protected system folder' }, { status: 409 })
  }

  // Check for duplicate name within company
  const { data: existing } = await adminClient
    .from('staff_document_folders')
    .select('id')
    .eq('company_id', companyId)
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'A folder with that name already exists' }, { status: 409 })
  }

  // Get next sort_order
  const { data: maxRow } = await adminClient
    .from('staff_document_folders')
    .select('sort_order')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = ((maxRow?.sort_order as number | null) ?? 0) + 10

  const { data: folder, error } = await adminClient
    .from('staff_document_folders')
    .insert({
      company_id:  companyId,
      name,
      slug,
      sort_order:  sortOrder,
      icon:        icon ?? 'folder_open',
      colour:      colour ?? '#6B7280',
      description: description ?? null,
      is_system:   false,
      is_custom:   true,
      created_by:  userId,
    })
    .select('id, name, slug, sort_order, icon, colour, description, is_system, is_custom')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'document_folder.created',
    entity_type: 'staff_document_folder',
    entity_id:   folder.id,
    metadata:    { name, slug, icon, colour },
  })

  return NextResponse.json({ folder }, { status: 201 })
}
