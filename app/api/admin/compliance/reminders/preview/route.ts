import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import { getAllReminders } from '@/lib/compliance/reminders'
import type { ReminderPayload } from '@/lib/compliance/reminders'

export interface ReminderPreviewResponse {
  total:         number
  expired:       ReminderPayload[]
  expiringSoon:  ReminderPayload[]
  missing:       ReminderPayload[]
  affectedStaff: string[]   // unique staff names
  generatedAt:   string
}

/**
 * GET /api/admin/compliance/reminders/preview
 *
 * Returns grouped compliance reminders for the authenticated company.
 * Read-only — no email is sent.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const reminders = await getAllReminders(companyId)

  const expired:      ReminderPayload[] = []
  const expiringSoon: ReminderPayload[] = []
  const missing:      ReminderPayload[] = []

  for (const r of reminders) {
    if (r.itemStatus === 'expired')       expired.push(r)
    else if (r.itemStatus === 'expiring_soon') expiringSoon.push(r)
    else if (r.itemStatus === 'missing')  missing.push(r)
  }

  const affectedStaff = [...new Set(reminders.map((r) => r.staffName))].sort()

  const response: ReminderPreviewResponse = {
    total: reminders.length,
    expired,
    expiringSoon,
    missing,
    affectedStaff,
    generatedAt: new Date().toISOString(),
  }

  console.info('[compliance/reminders/preview]', {
    companyId,
    expired:       expired.length,
    expiringSoon:  expiringSoon.length,
    missing:       missing.length,
    affectedStaff: affectedStaff.length,
  })

  return NextResponse.json(response)
}
