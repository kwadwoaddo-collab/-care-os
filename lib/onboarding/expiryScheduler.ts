import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

// ── Reminder cadence ──────────────────────────────────────────────────────────
//
// Smart reminder scheduling at 90/60/30/14/7/1-day thresholds.
// Each band fires AT MOST once per document per threshold.

export const REMINDER_BANDS = [90, 60, 30, 14, 7, 1] as const
export type ReminderBand = (typeof REMINDER_BANDS)[number]

export interface ScheduledReminder {
  documentId:    string
  staffProfileId: string
  companyId:     string
  documentType:  string
  fileName:      string
  expiryDate:    string
  daysRemaining: number
  reminderBand:  ReminderBand
  staffName:     string | null
  staffEmail:    string | null
}

// ── Find the applicable band for a days-remaining value ───────────────────────

export function getBand(daysRemaining: number): ReminderBand | null {
  for (const band of REMINDER_BANDS) {
    if (daysRemaining <= band) return band
  }
  return null
}

// ── Check if a reminder for this band has already been sent ───────────────────

export async function hasReminderBeenSent(
  documentId:    string,
  reminderBand:  number,
): Promise<boolean> {
  const { data } = await adminClient
    .from('document_expiry_reminders')
    .select('id')
    .eq('document_id', documentId)
    .eq('reminder_band', reminderBand)
    .maybeSingle()
  return !!data
}

// ── Record a sent reminder ────────────────────────────────────────────────────

export async function recordReminderSent(opts: {
  documentId:    string
  companyId:     string
  staffProfileId: string
  reminderBand:  number
  expiryDate:    string
  channel:       'in_app' | 'email' | 'operations_queue'
}): Promise<void> {
  await adminClient
    .from('document_expiry_reminders')
    .upsert({
      document_id:      opts.documentId,
      company_id:       opts.companyId,
      staff_profile_id: opts.staffProfileId,
      reminder_band:    opts.reminderBand,
      expiry_date:      opts.expiryDate,
      channel:          opts.channel,
      sent_at:          new Date().toISOString(),
    }, { onConflict: 'document_id,reminder_band', ignoreDuplicates: true })
}

// ── Fetch all documents that need expiry reminders ────────────────────────────

export async function getDueExpiryReminders(companyId: string): Promise<ScheduledReminder[]> {
  const today    = new Date()
  const cutoff90 = new Date(); cutoff90.setDate(today.getDate() + 90)

  // Docs expiring within 90 days, not already archived/superseded
  const { data: docs } = await adminClient
    .from('documents')
    .select(`
      id, document_type, file_name, expiry_date,
      company_id, staff_profile_id, verification_status,
      staff_profiles ( first_name, last_name, email )
    `)
    .eq('company_id', companyId)
    .is('archived_at', null)
    .not('verification_status', 'in', '("expired","superseded")')
    .not('staff_profile_id', 'is', null)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', cutoff90.toISOString().split('T')[0])
    .gte('expiry_date', today.toISOString().split('T')[0])

  if (!docs) return []

  const results: ScheduledReminder[] = []

  for (const doc of docs) {
    const daysRemaining = Math.ceil(
      (new Date(doc.expiry_date!).getTime() - today.getTime()) / 86400000
    )
    const band = getBand(daysRemaining)
    if (!band) continue

    const alreadySent = await hasReminderBeenSent(doc.id, band)
    if (alreadySent) continue

    const sp = (doc as Record<string, unknown>).staff_profiles as
      | { first_name: string | null; last_name: string | null; email: string | null }
      | null

    results.push({
      documentId:    doc.id,
      staffProfileId: doc.staff_profile_id!,
      companyId:     doc.company_id,
      documentType:  doc.document_type,
      fileName:      doc.file_name,
      expiryDate:    doc.expiry_date!,
      daysRemaining,
      reminderBand:  band,
      staffName:     sp ? [sp.first_name, sp.last_name].filter(Boolean).join(' ') : null,
      staffEmail:    sp?.email ?? null,
    })
  }

  return results
}

// ── Mark documents as expired ─────────────────────────────────────────────────

export async function markExpiredDocuments(companyId: string): Promise<{
  marked: number
}> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await adminClient
    .from('documents')
    .update({ verification_status: 'expired', reviewed_status: 'rejected' })
    .eq('company_id', companyId)
    .eq('verification_status', 'approved')
    .is('archived_at', null)
    .lt('expiry_date', today)
    .select('id')

  if (error) {
    console.error('[expiryScheduler.markExpiredDocuments]', error.message)
    return { marked: 0 }
  }

  return { marked: (data ?? []).length }
}

// ── Compliance risk forecast ──────────────────────────────────────────────────
//
// Returns count of workers with compliance-critical docs expiring within N days.

export async function getComplianceRiskForecast(companyId: string, days = 30): Promise<{
  atRiskWorkers:    number
  expiringDocCount: number
  byType:           Record<string, number>
}> {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + days)
  const today  = new Date().toISOString().split('T')[0]

  const { data: docs } = await adminClient
    .from('documents')
    .select('document_type, staff_profile_id')
    .eq('company_id', companyId)
    .eq('verification_status', 'approved')
    .eq('compliance_linked', true)
    .is('archived_at', null)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', cutoff.toISOString().split('T')[0])
    .gte('expiry_date', today)

  const items = docs ?? []
  const workerSet = new Set(items.map((d) => d.staff_profile_id))
  const byType: Record<string, number> = {}
  for (const doc of items) {
    byType[doc.document_type] = (byType[doc.document_type] ?? 0) + 1
  }

  return {
    atRiskWorkers:    workerSet.size,
    expiringDocCount: items.length,
    byType,
  }
}
