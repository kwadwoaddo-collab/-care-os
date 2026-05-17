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
    .from('tenant_config')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ config: data })
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

  // Only allow safe scalar fields — no FK columns
  const allowed = [
    'is_active', 'is_pilot', 'go_live_date', 'timezone',
    'compliance_dbs_expiry_days', 'compliance_rtw_expiry_days',
    'compliance_training_days', 'compliance_warning_days', 'compliance_critical_days',
    'escalation_unresolved_hours', 'escalation_critical_hours',
    'block_non_compliant_staff', 'block_expired_dbs', 'block_expired_rtw',
    'require_dbs', 'require_rtw', 'require_references',
    'require_id_verification', 'require_contract_signature',
    'max_weekly_hours', 'overtime_threshold_hours', 'shift_gap_minimum_hours',
    'notify_expiry_email', 'notify_expiry_in_app',
    'notify_safeguarding_email', 'notify_onboarding_stale',
    'allow_compliance_override', 'allow_shift_override',
    'setup_step',
  ] as const

  type AllowedKey = typeof allowed[number]
  const payload: Partial<Record<AllowedKey, unknown>> & { company_id: string; updated_at: string } = {
    company_id:  companyId,
    updated_at:  new Date().toISOString(),
  }

  for (const key of allowed) {
    if (key in body) payload[key] = body[key]
  }

  const { data, error } = await adminClient
    .from('tenant_config')
    .upsert(payload, { onConflict: 'company_id' })
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ config: data })
}
