/**
 * lib/jobs/types.ts
 * Shared types for the Care OS background job framework.
 */

export type JobStatus   = 'running' | 'success' | 'failed' | 'retrying' | 'cancelled' | 'skipped'
export type JobTrigger  = 'cron' | 'manual' | 'retry' | 'system'

// ── Job definition (registry entry) ──────────────────────────────────────────

export interface JobDefinition {
  /** Unique, stable job name — used as the DB key */
  name:        string
  /** Human-readable description shown in dashboard */
  description: string
  /** Cron schedule expression (Vercel format) */
  schedule:    string
  /** Human-readable schedule */
  scheduleLabel: string
  /** Maximum retries on failure */
  maxRetries:  number
  /** Lock TTL in ms — prevents duplicate concurrent runs */
  lockTtlMs:   number
  /** Expected max duration in ms — used to detect stuck jobs */
  timeoutMs:   number
  /** Whether this job is company-scoped or system-wide */
  scope:       'company' | 'system'
  /** Is this job currently enabled? */
  enabled:     boolean
}

// ── Execution result ──────────────────────────────────────────────────────────

export interface JobResult {
  ok:       boolean
  skipped?: boolean
  message?: string
  data?:    Record<string, unknown>
  errors?:  string[]
}

// ── Execution context ─────────────────────────────────────────────────────────

export interface JobContext {
  executionId: string
  jobName:     string
  companyId?:  string
  triggeredBy: JobTrigger
  startedAt:   Date
}

// ── DB row shape ──────────────────────────────────────────────────────────────

export interface JobExecutionRow {
  id:            string
  job_name:      string
  company_id:    string | null
  status:        JobStatus
  started_at:    string
  completed_at:  string | null
  duration_ms:   number | null
  retry_count:   number
  max_retries:   number
  parent_id:     string | null
  error_message: string | null
  error_detail:  string | null
  result:        Record<string, unknown>
  triggered_by:  JobTrigger
  instance_id:   string | null
  created_at:    string
}
