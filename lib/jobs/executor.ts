import 'server-only'

import { adminClient } from '@/lib/supabase/admin'
import { logger }      from '@/lib/logger'
import { getJobDef }   from './registry'
import type { JobResult, JobTrigger, JobContext, JobExecutionRow } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function lockKey(jobName: string, companyId?: string): string {
  return `${jobName}:${companyId ?? 'system'}`
}

function instanceId(): string {
  return process.env.VERCEL_INSTANCE_ID
    ?? process.env.HOSTNAME
    ?? `node-${Math.random().toString(36).slice(2, 8)}`
}

// ── Lock management ───────────────────────────────────────────────────────────

async function acquireLock(
  execId:    string,
  jobName:   string,
  ttlMs:     number,
  companyId?: string,
): Promise<boolean> {
  const key       = lockKey(jobName, companyId)
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()

  // Clean up expired locks first
  await adminClient.from('job_locks').delete().eq('lock_key', key).lt('expires_at', new Date().toISOString())

  const { error } = await adminClient.from('job_locks').insert({
    lock_key:     key,
    execution_id: execId,
    expires_at:   expiresAt,
    instance_id:  instanceId(),
  })

  // Unique constraint violation means another instance holds the lock
  if (error) {
    if (error.code === '23505') return false  // duplicate key
    logger.warn('[executor] lock insert error', { jobName, error: error.message })
    return false
  }

  return true
}

async function releaseLock(jobName: string, companyId?: string): Promise<void> {
  const key = lockKey(jobName, companyId)
  await adminClient.from('job_locks').delete().eq('lock_key', key)
}

// ── Metric recording ──────────────────────────────────────────────────────────

async function recordMetric(
  metricName: string,
  value: number,
  companyId?: string,
  tags?: Record<string, unknown>,
): Promise<void> {
  try {
    // Keep only last 30 days — delete old before inserting
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString()
    await adminClient.from('system_metrics')
      .delete()
      .eq('metric_name', metricName)
      .lt('recorded_at', cutoff)

    await adminClient.from('system_metrics').insert({
      company_id:   companyId ?? null,
      metric_name:  metricName,
      metric_value: value,
      tags:         tags ?? {},
    })
  } catch (err) {
    logger.warn('[executor] metric record error', { metricName, error: String(err) })
  }
}

// ── Main executor ─────────────────────────────────────────────────────────────

export interface ExecuteJobOptions {
  jobName:     string
  companyId?:  string
  triggeredBy: JobTrigger
  parentId?:   string
  retryCount?: number
}

/**
 * Wrap any async job function with execution tracking, locking, and metrics.
 *
 * Usage:
 *   const result = await executeJob(
 *     { jobName: 'compliance_sweep', triggeredBy: 'cron' },
 *     () => sweepAllCompanies(),
 *   )
 */
export async function executeJob(
  opts: ExecuteJobOptions,
  fn: (ctx: JobContext) => Promise<JobResult>,
): Promise<JobResult & { executionId: string }> {
  const { jobName, companyId, triggeredBy, parentId, retryCount = 0 } = opts
  const def = getJobDef(jobName)

  const startedAt = new Date()
  const t0 = Date.now()

  // Create execution row
  const { data: execRow, error: insertErr } = await adminClient
    .from('job_executions')
    .insert({
      job_name:     jobName,
      company_id:   companyId ?? null,
      status:       'running',
      retry_count:  retryCount,
      max_retries:  def?.maxRetries ?? 3,
      parent_id:    parentId ?? null,
      triggered_by: triggeredBy,
      instance_id:  instanceId(),
      started_at:   startedAt.toISOString(),
    })
    .select('id')
    .single()

  if (insertErr || !execRow) {
    logger.error('[executor] failed to create execution row', { jobName, error: insertErr?.message })
    return { ok: false, executionId: 'unknown', message: 'Failed to register job execution' }
  }

  const executionId = (execRow as { id: string }).id
  const lockTtlMs   = def?.lockTtlMs ?? 5 * 60_000

  // Acquire lock
  const locked = await acquireLock(executionId, jobName, lockTtlMs, companyId)
  if (!locked) {
    await adminClient.from('job_executions').update({
      status:       'skipped',
      completed_at: new Date().toISOString(),
      duration_ms:  0,
      result:       { reason: 'lock_held_by_another_instance' },
    }).eq('id', executionId)

    logger.info('[executor] job skipped — lock held', { jobName, companyId })
    return { ok: true, skipped: true, executionId, message: 'Another instance is running this job' }
  }

  const ctx: JobContext = {
    executionId,
    jobName,
    companyId,
    triggeredBy,
    startedAt,
  }

  // Execute
  let result: JobResult
  try {
    result = await fn(ctx)

    const durationMs = Date.now() - t0
    await adminClient.from('job_executions').update({
      status:       result.ok ? 'success' : 'failed',
      completed_at: new Date().toISOString(),
      duration_ms:  durationMs,
      result:       result.data ?? {},
      error_message: result.ok ? null : (result.message ?? 'Job reported failure'),
    }).eq('id', executionId)

    void recordMetric(`job.duration.${jobName}`, durationMs, companyId, { status: result.ok ? 'success' : 'failed' })

    logger.info('[executor] job complete', { jobName, status: result.ok ? 'success' : 'failed', durationMs })

  } catch (err) {
    const durationMs    = Date.now() - t0
    const errorMessage  = err instanceof Error ? err.message : String(err)
    const errorDetail   = err instanceof Error ? err.stack  : undefined

    await adminClient.from('job_executions').update({
      status:        'failed',
      completed_at:  new Date().toISOString(),
      duration_ms:   durationMs,
      error_message: errorMessage,
      error_detail:  errorDetail ?? null,
    }).eq('id', executionId)

    void recordMetric(`job.duration.${jobName}`, durationMs, companyId, { status: 'failed' })

    logger.error('[executor] job threw', { jobName, error: errorMessage })
    result = { ok: false, message: errorMessage }
  } finally {
    await releaseLock(jobName, companyId)
  }

  return { ...result, executionId }
}

// ── CRON_SECRET guard ─────────────────────────────────────────────────────────

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// ── Retry helper ──────────────────────────────────────────────────────────────

export async function canRetry(execId: string): Promise<{ allowed: boolean; row?: JobExecutionRow }> {
  const { data } = await adminClient
    .from('job_executions')
    .select('*')
    .eq('id', execId)
    .maybeSingle()

  if (!data) return { allowed: false }
  const row = data as JobExecutionRow

  if (row.status !== 'failed') return { allowed: false, row }
  if (row.retry_count >= row.max_retries) return { allowed: false, row }

  return { allowed: true, row }
}

// ── Stuck job detection ───────────────────────────────────────────────────────

export async function detectStuckJobs(): Promise<{ jobName: string; executionId: string; runningMinutes: number }[]> {
  const { data } = await adminClient
    .from('job_executions')
    .select('id, job_name, started_at')
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - 15 * 60_000).toISOString())  // running > 15 min

  return (data ?? []).map(r => ({
    jobName:        r.job_name as string,
    executionId:    r.id as string,
    runningMinutes: Math.round((Date.now() - new Date(r.started_at as string).getTime()) / 60_000),
  }))
}
