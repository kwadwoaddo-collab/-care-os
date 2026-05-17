import { NextRequest, NextResponse } from 'next/server'
import { adminClient }   from '@/lib/supabase/admin'
import { requireAdmin }  from '@/lib/auth/requireAdmin'
import { can }           from '@/lib/auth/permissions'
import { forbidden }     from '@/lib/auth/responses'
import { JOB_REGISTRY }  from '@/lib/jobs/registry'
import { detectStuckJobs, executeJob } from '@/lib/jobs/executor'
import type { JobExecutionRow } from '@/lib/jobs/types'

export interface JobsResponse {
  jobs: JobSummary[]
  recentExecutions: JobExecutionRow[]
  stuckJobs: { jobName: string; executionId: string; runningMinutes: number }[]
  stats: {
    totalToday:   number
    successToday: number
    failedToday:  number
    skippedToday: number
  }
}

export interface JobSummary {
  name:          string
  description:   string
  schedule:      string
  scheduleLabel: string
  enabled:       boolean
  scope:         string
  lastExecution: JobExecutionRow | null
  successRate:   number | null  // last 7 days, 0-100
}

// GET /api/admin/system/jobs
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'system:read')) return forbidden('Insufficient permissions')

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)

  // ── Fetch recent executions ───────────────────────────────────────────────
  const { data: recent, error: recentErr } = await adminClient
    .from('job_executions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (recentErr) {
    return NextResponse.json({ error: recentErr.message }, { status: 500 })
  }

  const recentExecutions = (recent ?? []) as JobExecutionRow[]

  // ── Today's stats ─────────────────────────────────────────────────────────
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data: todayRows } = await adminClient
    .from('job_executions')
    .select('status')
    .gte('started_at', todayStart.toISOString())

  const stats = {
    totalToday:   todayRows?.length ?? 0,
    successToday: todayRows?.filter(r => r.status === 'success').length ?? 0,
    failedToday:  todayRows?.filter(r => r.status === 'failed').length ?? 0,
    skippedToday: todayRows?.filter(r => r.status === 'skipped').length ?? 0,
  }

  // ── Last execution + 7-day success rate per job ───────────────────────────
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data: week7 } = await adminClient
    .from('job_executions')
    .select('job_name, status')
    .gte('started_at', since7d)
    .in('status', ['success', 'failed'])

  const rateByJob: Record<string, { success: number; total: number }> = {}
  for (const row of week7 ?? []) {
    const name = row.job_name as string
    if (!rateByJob[name]) rateByJob[name] = { success: 0, total: 0 }
    rateByJob[name].total++
    if (row.status === 'success') rateByJob[name].success++
  }

  const lastByJob: Record<string, JobExecutionRow> = {}
  for (const row of recentExecutions) {
    if (!lastByJob[row.job_name]) lastByJob[row.job_name] = row
  }

  const jobs: JobSummary[] = JOB_REGISTRY.map(def => {
    const rates = rateByJob[def.name]
    return {
      name:          def.name,
      description:   def.description,
      schedule:      def.schedule,
      scheduleLabel: def.scheduleLabel,
      enabled:       def.enabled,
      scope:         def.scope,
      lastExecution: lastByJob[def.name] ?? null,
      successRate:   rates ? Math.round((rates.success / rates.total) * 100) : null,
    }
  })

  // ── Stuck job detection ───────────────────────────────────────────────────
  const stuckJobs = await detectStuckJobs()

  return NextResponse.json({ jobs, recentExecutions, stuckJobs, stats } satisfies JobsResponse)
}

// POST /api/admin/system/jobs — manual trigger
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'system:write')) return forbidden('Insufficient permissions')

  const body = await req.json().catch(() => ({})) as { jobName?: string }
  const { jobName } = body

  if (!jobName) {
    return NextResponse.json({ error: 'jobName is required' }, { status: 400 })
  }

  const def = JOB_REGISTRY.find(j => j.name === jobName)
  if (!def) {
    return NextResponse.json({ error: `Unknown job: ${jobName}` }, { status: 400 })
  }

  // Manually trigger via internal fetch to the cron route
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const slug = jobName.replace(/_/g, '-')
  const response = await fetch(`${baseUrl}/api/cron/${slug}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${cronSecret}` },
  })

  if (!response.ok) {
    const text = await response.text()
    return NextResponse.json({ error: `Cron route returned ${response.status}: ${text}` }, { status: 500 })
  }

  const result = await response.json()
  return NextResponse.json({ triggered: true, jobName, result })
}
