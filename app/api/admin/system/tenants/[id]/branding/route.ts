import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'tenants:read')) return forbidden('Tenant administration requires super_admin')

  const { id: companyId } = await params

  const { data, error } = await adminClient
    .from('tenant_branding')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ branding: data })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'tenants:write')) return forbidden('Tenant administration requires super_admin')

  const { id: companyId } = await params
  const body = await req.json()

  const payload = {
    company_id:    companyId,
    logo_url:      body.logo_url      ?? null,
    accent_colour: body.accent_colour ?? '#4f46e5',
    company_name:  body.company_name  ?? null,
    email_from:    body.email_from    ?? null,
    login_tagline: body.login_tagline ?? null,
    updated_at:    new Date().toISOString(),
  }

  const { data, error } = await adminClient
    .from('tenant_branding')
    .upsert(payload, { onConflict: 'company_id' })
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ branding: data })
}
