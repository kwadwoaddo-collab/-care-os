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

  const [companyRes, cfgRes, brandingRes] = await Promise.all([
    adminClient.from('companies').select('*').eq('id', companyId).maybeSingle(),
    adminClient.from('tenant_config').select('*').eq('company_id', companyId).maybeSingle(),
    adminClient.from('tenant_branding').select('*').eq('company_id', companyId).maybeSingle(),
  ])

  if (!companyRes.data) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  return NextResponse.json({
    company:  companyRes.data,
    config:   cfgRes.data,
    branding: brandingRes.data,
  })
}
