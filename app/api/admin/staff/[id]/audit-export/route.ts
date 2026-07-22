import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import { buildStaffAuditPdf } from '@/lib/documents/staff-audit'

// ── GET /api/admin/staff/[id]/audit-export ───────────────────────────────────
//
// CQC-ready compliance file for one staff member: application data, interview
// notes, pre-employment checks, compliance status, training records, signed
// agreements/policies, and uploaded documents — one paginated PDF.
//
// Read-only. Not gated behind lib/features.ts — ENABLE_STAFF_AUDIT_EXPORT only
// controls whether the "Export staff file" button renders; requireAdmin() +
// can('compliance:read') are the actual access control here.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  const result = await buildStaffAuditPdf(staffProfileId, companyId)

  if (!result.ok || !result.pdfBytes) {
    const status = result.error === 'Staff profile not found' ? 404 : 500
    return NextResponse.json({ error: result.error ?? 'Failed to generate audit file' }, { status })
  }

  return new NextResponse(Buffer.from(result.pdfBytes), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
    },
  })
}
