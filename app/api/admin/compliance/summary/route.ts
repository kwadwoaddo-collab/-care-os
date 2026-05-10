import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import { classifyItems, type StatusCounts } from '@/lib/compliance/status'

export type ComplianceSummaryResponse = StatusCounts

/**
 * GET /api/admin/compliance/summary
 *
 * Returns aggregate compliance_items status counts for the authenticated
 * admin's company. Lightweight — no document joins, just item status math.
 *
 * Response shape: StatusCounts
 *   { compliant, expiring_soon, expired, missing, rejected, in_review, total }
 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { data, error } = await adminClient
    .from('compliance_items')
    .select('status, expires_at')
    .eq('company_id', companyId)

  if (error) {
    console.error('[compliance/summary] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch compliance summary' }, { status: 500 })
  }

  const counts = classifyItems(
    (data ?? []).map((row) => ({
      status:     row.status     as string,
      expires_at: row.expires_at as string | null,
    })),
  )

  return NextResponse.json(counts satisfies ComplianceSummaryResponse)
}
