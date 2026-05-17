/**
 * lib/jobs/registry.ts
 * Central registry of all scheduled background jobs in Care OS.
 * This is the single source of truth for job metadata shown in /admin/system/jobs.
 */

import type { JobDefinition } from './types'

export const JOB_REGISTRY: JobDefinition[] = [
  {
    name:          'compliance_sweep',
    description:   'Sweeps all companies for compliance issues: calculates risk scores, creates escalations, sends in-app notifications to staff with expiring items.',
    schedule:      '0 6 * * *',
    scheduleLabel: 'Daily at 06:00 UTC',
    maxRetries:    3,
    lockTtlMs:     10 * 60_000,   // 10 min lock
    timeoutMs:     8  * 60_000,   // stuck after 8 min
    scope:         'system',
    enabled:       true,
  },
  {
    name:          'compliance_reminders',
    description:   'Sends email digest of compliance issues (expired, expiring, missing docs) to company admins. Respects notification preferences and 24-hour dedup window.',
    schedule:      '0 7 * * *',
    scheduleLabel: 'Daily at 07:00 UTC',
    maxRetries:    3,
    lockTtlMs:     10 * 60_000,
    timeoutMs:     8  * 60_000,
    scope:         'system',
    enabled:       true,
  },
  {
    name:          'anomaly_scan',
    description:   'Scans for visit anomalies: late arrivals (≥15 min), short visits (<80% scheduled), no-shows (>30 min past start), and medication escalations.',
    schedule:      '0 8 * * *',
    scheduleLabel: 'Daily at 08:00 UTC',
    maxRetries:    3,
    lockTtlMs:     5  * 60_000,
    timeoutMs:     4  * 60_000,
    scope:         'system',
    enabled:       true,
  },
  {
    name:          'comms_triggers',
    description:   'Fires smart communication triggers: compliance expiry reminders, onboarding stall alerts, uncovered shift warnings, safeguarding escalation notifications.',
    schedule:      '0 9 * * *',
    scheduleLabel: 'Daily at 09:00 UTC',
    maxRetries:    3,
    lockTtlMs:     8  * 60_000,
    timeoutMs:     6  * 60_000,
    scope:         'system',
    enabled:       true,
  },
  {
    name:          'escalation_scan',
    description:   'Reviews open incidents and compliance overrides. Flags unresolved escalations beyond SLA (5 days), sends reminders to registered managers.',
    schedule:      '0 10 * * *',
    scheduleLabel: 'Daily at 10:00 UTC',
    maxRetries:    3,
    lockTtlMs:     5  * 60_000,
    timeoutMs:     4  * 60_000,
    scope:         'system',
    enabled:       true,
  },
]

/** Look up a job by name */
export function getJobDef(name: string): JobDefinition | undefined {
  return JOB_REGISTRY.find(j => j.name === name)
}

/** All enabled job names */
export const ENABLED_JOB_NAMES = JOB_REGISTRY.filter(j => j.enabled).map(j => j.name)
