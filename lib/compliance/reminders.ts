import 'server-only'

import { adminClient } from '@/lib/supabase/admin'
import {
  getItemStatus,
  EXPIRY_NOTICE_DAYS,
  type ItemStatus,
} from './status'

// ── Payload types ─────────────────────────────────────────────────────────────

/**
 * A prepared reminder payload for one staff member + item combination.
 * Contains everything an email sender needs — no DB access required at send time.
 */
export interface ReminderPayload {
  companyId:      string
  staffProfileId: string
  staffName:      string
  staffEmail:     string | null
  itemType:       string
  itemStatus:     ItemStatus  // 'expired' | 'expiring_soon' | 'missing'
  expiresAt:      string | null
}

// ── DB row shape returned by the query ───────────────────────────────────────

interface ComplianceItemRow {
  id:               string
  company_id:       string
  staff_profile_id: string
  item_type:        string
  status:           string
  expires_at:       string | null
  // Supabase returns many-to-one joins as an array; we take [0]
  staff_profiles:   { first_name: string | null; last_name: string | null; email: string | null }[] | null
}

// ── Reminder queries ──────────────────────────────────────────────────────────

/**
 * Returns items that are expired or expiring soon for a given company.
 * Scoped to items with status = 'complete' or 'expired' that have an expiry date.
 * Does NOT send any emails — callers decide when to trigger sending.
 */
export async function getExpiryReminders(
  companyId: string,
): Promise<ReminderPayload[]> {
  const noticeWindowEnd = new Date()
  noticeWindowEnd.setDate(noticeWindowEnd.getDate() + EXPIRY_NOTICE_DAYS)

  const { data, error } = await adminClient
    .from('compliance_items')
    .select(`
      id,
      company_id,
      staff_profile_id,
      item_type,
      status,
      expires_at,
      staff_profiles ( first_name, last_name, email )
    `)
    .eq('company_id', companyId)
    .in('status', ['complete', 'expired'])
    .not('expires_at', 'is', null)
    .lte('expires_at', noticeWindowEnd.toISOString().slice(0, 10))

  if (error) {
    console.error('[compliance/reminders] getExpiryReminders error:', error.message)
    return []
  }

  return (data as ComplianceItemRow[])
    .map((row): ReminderPayload | null => {
      const status = getItemStatus({ status: row.status, expires_at: row.expires_at })
      if (status !== 'expired' && status !== 'expiring_soon') return null

      const sp = row.staff_profiles?.[0] ?? null
      const staffName = [sp?.first_name, sp?.last_name].filter(Boolean).join(' ') || 'Unknown'

      return {
        companyId:      row.company_id,
        staffProfileId: row.staff_profile_id,
        staffName,
        staffEmail:     sp?.email ?? null,
        itemType:       row.item_type,
        itemStatus:     status,
        expiresAt:      row.expires_at,
      }
    })
    .filter((p): p is ReminderPayload => p !== null)
}

/**
 * Returns items with status = 'not_started' (missing evidence) for a company.
 * Useful for "please submit your documents" reminders.
 */
export async function getMissingItemReminders(
  companyId: string,
): Promise<ReminderPayload[]> {
  const { data, error } = await adminClient
    .from('compliance_items')
    .select(`
      id,
      company_id,
      staff_profile_id,
      item_type,
      status,
      expires_at,
      staff_profiles ( first_name, last_name, email )
    `)
    .eq('company_id', companyId)
    .eq('status', 'not_started')

  if (error) {
    console.error('[compliance/reminders] getMissingItemReminders error:', error.message)
    return []
  }

  return (data as ComplianceItemRow[]).map((row): ReminderPayload => {
    const sp = row.staff_profiles?.[0] ?? null
    const staffName = [sp?.first_name, sp?.last_name].filter(Boolean).join(' ') || 'Unknown'
    return {
      companyId:      row.company_id,
      staffProfileId: row.staff_profile_id,
      staffName,
      staffEmail:     sp?.email ?? null,
      itemType:       row.item_type,
      itemStatus:     'missing',
      expiresAt:      null,
    }
  })
}

/**
 * Convenience: fetch both expiry and missing reminders in one call.
 * Returns combined, deduplicated by (staffProfileId, itemType).
 */
export async function getAllReminders(
  companyId: string,
): Promise<ReminderPayload[]> {
  const [expiry, missing] = await Promise.all([
    getExpiryReminders(companyId),
    getMissingItemReminders(companyId),
  ])

  const seen = new Set<string>()
  const results: ReminderPayload[] = []

  for (const p of [...expiry, ...missing]) {
    const key = `${p.staffProfileId}:${p.itemType}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push(p)
    }
  }

  return results
}
