import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

export interface TenantHealthResponse {
  company_id:             string
  company_name:           string
  is_active:              boolean
  critical_issues:        number
  blocked_staff:          number
  uncovered_shifts:       number
  compliance_risk_level:  'low' | 'medium' | 'high' | 'critical'
  safeguarding_alerts:    number
  onboarding_backlog:     number  // pre_employment > 30 days
  stale_applicants:       number  // applied/shortlisted > 60 days
  open_incidents:         number
  expiring_soon:          number  // compliance items expiring in <30 days
  timestamp:              string
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'tenants:read')) return forbidden('Tenant administration requires super_admin')

  const { id: companyId } = await params

  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  const { data: cfg } = await adminClient
    .from('tenant_config')
    .select('is_active')
    .eq('company_id', companyId)
    .maybeSingle()

  const cutoff30  = new Date(Date.now() - 30 * 86400_000).toISOString()
  const cutoff60  = new Date(Date.now() - 60 * 86400_000).toISOString()
  const in30days  = new Date(Date.now() + 30 * 86400_000).toISOString()

  const [
    expiredRes,
    expiringSoonRes,
    onboardingBacklogRes,
    staleApplicantsRes,
    openIncidentsRes,
    safeguardingRes,
    uncoveredShiftsRes,
  ] = await Promise.all([
    // Expired compliance items (blocked staff proxy)
    adminClient
      .from('staff_compliance')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['expired', 'rejected']),
    // Expiring soon
    adminClient
      .from('staff_compliance')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'complete')
      .not('expires_at', 'is', null)
      .lt('expires_at', in30days)
      .gt('expires_at', new Date().toISOString()),
    // Onboarding backlog: pre_employment > 30 days
    adminClient
      .from('staff_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pre_employment')
      .lt('created_at', cutoff30),
    // Stale applicants > 60 days
    adminClient
      .from('applicants')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['applied', 'shortlisted'])
      .lt('created_at', cutoff60)
      .is('deleted_at', null),
    // Open incidents
    adminClient
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['open', 'investigating']),
    // Safeguarding alerts (critical/high severity incidents)
    adminClient
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('severity', ['critical', 'high'])
      .in('status', ['open', 'investigating']),
    // Uncovered shifts (scheduled but no assigned staff)
    adminClient
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'scheduled')
      .is('assigned_staff_id', null),
  ])

  const expiredCount   = expiredRes.count ?? 0
  const criticalIssues = expiredCount + (safeguardingRes.count ?? 0)
  let compliance_risk_level: TenantHealthResponse['compliance_risk_level'] = 'low'
  if (expiredCount >= 10)     compliance_risk_level = 'critical'
  else if (expiredCount >= 5) compliance_risk_level = 'high'
  else if (expiredCount >= 2) compliance_risk_level = 'medium'

  return NextResponse.json({
    company_id:            companyId,
    company_name:          company?.name ?? 'Unknown',
    is_active:             cfg?.is_active ?? true,
    critical_issues:       criticalIssues,
    blocked_staff:         expiredCount,
    uncovered_shifts:      uncoveredShiftsRes.count ?? 0,
    compliance_risk_level,
    safeguarding_alerts:   safeguardingRes.count ?? 0,
    onboarding_backlog:    onboardingBacklogRes.count ?? 0,
    stale_applicants:      staleApplicantsRes.count ?? 0,
    open_incidents:        openIncidentsRes.count ?? 0,
    expiring_soon:         expiringSoonRes.count ?? 0,
    timestamp:             new Date().toISOString(),
  } satisfies TenantHealthResponse)
}
