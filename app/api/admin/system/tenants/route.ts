import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

export interface TenantSummary {
  id:               string
  name:             string
  slug:             string
  created_at:       string
  is_active:        boolean
  is_pilot:         boolean
  go_live_date:     string | null
  setup_step:       number
  setup_completed:  boolean
  admin_count:      number
  staff_count:      number
  applicant_count:  number
  compliance_risk:  'low' | 'medium' | 'high' | 'critical' | 'unknown'
  storage_estimate: number  // approximate MB
  accent_colour:    string
  logo_url:         string | null
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'tenants:read')) return forbidden('Tenant administration requires super_admin')

  // ── Fetch all companies ───────────────────────────────────────────────────────
  const { data: companies, error: compErr } = await adminClient
    .from('companies')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: true })

  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 })
  }

  const tenants: TenantSummary[] = await Promise.all(
    (companies ?? []).map(async (company) => {
      const cid = company.id as string

      // Tenant config
      const { data: cfg } = await adminClient
        .from('tenant_config')
        .select('is_active, is_pilot, go_live_date, setup_step, setup_completed_at')
        .eq('company_id', cid)
        .maybeSingle()

      // Branding
      const { data: branding } = await adminClient
        .from('tenant_branding')
        .select('accent_colour, logo_url')
        .eq('company_id', cid)
        .maybeSingle()

      // Counts
      const [adminRes, staffRes, applicantRes, riskRes] = await Promise.all([
        adminClient
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', cid)
          .in('role', ['super_admin', 'company_admin', 'registered_manager', 'compliance_manager', 'coordinator']),
        adminClient
          .from('staff_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', cid)
          .in('status', ['active', 'pre_employment']),
        adminClient
          .from('applicants')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', cid)
          .is('deleted_at', null),
        // Compliance risk: count staff with any expired/rejected compliance items
        adminClient
          .from('staff_compliance')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', cid)
          .in('status', ['expired', 'rejected']),
      ])

      const expiredCount = riskRes.count ?? 0
      let compliance_risk: TenantSummary['compliance_risk'] = 'low'
      if (expiredCount >= 10)      compliance_risk = 'critical'
      else if (expiredCount >= 5)  compliance_risk = 'high'
      else if (expiredCount >= 2)  compliance_risk = 'medium'

      // Storage estimate: 1 MB per staff document (very rough)
      const { count: docCount } = await adminClient
        .from('staff_documents')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', cid)

      return {
        id:               cid,
        name:             company.name as string,
        slug:             company.slug as string,
        created_at:       company.created_at as string,
        is_active:        cfg?.is_active ?? true,
        is_pilot:         cfg?.is_pilot ?? false,
        go_live_date:     cfg?.go_live_date ?? null,
        setup_step:       cfg?.setup_step ?? 0,
        setup_completed:  Boolean(cfg?.setup_completed_at),
        admin_count:      adminRes.count ?? 0,
        staff_count:      staffRes.count ?? 0,
        applicant_count:  applicantRes.count ?? 0,
        compliance_risk,
        storage_estimate: (docCount ?? 0) * 1,
        accent_colour:    branding?.accent_colour ?? '#4f46e5',
        logo_url:         branding?.logo_url ?? null,
      }
    })
  )

  return NextResponse.json({ tenants })
}
