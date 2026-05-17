import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

/**
 * Check if a message suppression key is currently active.
 * Returns true if still suppressed (caller should skip sending).
 */
export async function isSuppressed(
  companyId: string,
  key: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from('message_suppression')
    .select('suppressed_until')
    .eq('company_id', companyId)
    .eq('suppression_key', key)
    .maybeSingle()

  if (!data) return false
  return new Date(data.suppressed_until as string) > new Date()
}

/**
 * Record a suppression window.
 * @param windowHours  How many hours to suppress repeated sends (default 24)
 */
export async function recordSuppression(
  companyId: string,
  key: string,
  messageId: string,
  windowHours = 24,
): Promise<void> {
  const suppressedUntil = new Date(Date.now() + windowHours * 3_600_000).toISOString()
  await adminClient
    .from('message_suppression')
    .upsert(
      { company_id: companyId, suppression_key: key, suppressed_until: suppressedUntil, message_id: messageId },
      { onConflict: 'company_id,suppression_key' },
    )
}

/**
 * Clear suppression (e.g., after an item is resolved).
 */
export async function clearSuppression(companyId: string, key: string): Promise<void> {
  await adminClient
    .from('message_suppression')
    .delete()
    .eq('company_id', companyId)
    .eq('suppression_key', key)
}

/** Build a standard suppression key for compliance expiry reminders. */
export function complianceSuppressKey(staffId: string, checkType: string): string {
  return `compliance_expiry:${staffId}:${checkType}`
}

/** Build a suppression key for onboarding stall reminders. */
export function onboardingSuppressKey(staffId: string): string {
  return `onboarding_stall:${staffId}`
}

/** Build a suppression key for uncovered shift alerts. */
export function shiftCoverageSuppressKey(shiftId: string): string {
  return `shift_coverage:${shiftId}`
}
