import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// Wizard steps: 0=company_details, 1=branding, 2=contact, 3=timezone,
// 4=compliance_defaults, 5=roles, 6=shifts, 7=notifications → complete

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'tenants:write')) return forbidden('Tenant administration requires super_admin')

  const { id: companyId } = await params
  const body = await req.json()
  const { step, data: stepData } = body as { step: number; data: Record<string, unknown> }

  if (typeof step !== 'number' || step < 0 || step > 7) {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
  }

  // Save branding fields if present
  if (stepData.accent_colour || stepData.logo_url || stepData.company_name || stepData.login_tagline || stepData.email_from) {
    const brandingPayload = {
      company_id:    companyId,
      accent_colour: stepData.accent_colour ?? '#4f46e5',
      logo_url:      stepData.logo_url      ?? null,
      company_name:  stepData.company_name  ?? null,
      login_tagline: stepData.login_tagline ?? null,
      email_from:    stepData.email_from    ?? null,
      updated_at:    new Date().toISOString(),
    }
    await adminClient
      .from('tenant_branding')
      .upsert(brandingPayload, { onConflict: 'company_id' })
  }

  // Save config fields and advance step
  const isLastStep = step === 7
  const configPayload: Record<string, unknown> = {
    company_id:  companyId,
    setup_step:  step + 1,
    updated_at:  new Date().toISOString(),
    ...(isLastStep ? { setup_completed_at: new Date().toISOString() } : {}),
  }

  const configFields = [
    'timezone', 'compliance_dbs_expiry_days', 'compliance_rtw_expiry_days',
    'compliance_training_days', 'compliance_warning_days', 'compliance_critical_days',
    'escalation_unresolved_hours', 'escalation_critical_hours',
    'block_non_compliant_staff', 'block_expired_dbs', 'block_expired_rtw',
    'require_dbs', 'require_rtw', 'require_references',
    'require_id_verification', 'require_contract_signature',
    'max_weekly_hours', 'overtime_threshold_hours', 'shift_gap_minimum_hours',
    'notify_expiry_email', 'notify_expiry_in_app',
    'notify_safeguarding_email', 'notify_onboarding_stale',
    'allow_compliance_override', 'allow_shift_override',
    'is_pilot', 'go_live_date',
  ]
  for (const field of configFields) {
    if (field in stepData) configPayload[field] = stepData[field]
  }

  const { error } = await adminClient
    .from('tenant_config')
    .upsert(configPayload, { onConflict: 'company_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, next_step: step + 1, completed: isLastStep })
}
