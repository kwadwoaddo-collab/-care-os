'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  PageHeader,
  SectionHeader,
  MetricCard,
  MetricGrid,
  OperationalBanner,
  Skeleton,
  Button,
  SeverityBadge,
  EmptyState,
} from '@/components/ui'
import type { JobsResponse, JobSummary } from '@/app/api/admin/system/jobs/route'
import type { JobExecutionRow } from '@/lib/jobs/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtRelative(iso: string | null): string {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins   = Math.round(diffMs / 60_000)
  if (mins < 2)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'critical' | 'warning' | 'info' | 'neutral'> = {
    success:  'success',
    failed:   'critical',
    retrying: 'warning',
    running:  'info',
    skipped:  'neutral',
    cancelled: 'neutral',
  }
  return <SeverityBadge level={map[status] ?? 'neutral'} label={status} />
}

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onTrigger,
  triggering,
}: {
  job: JobSummary
  onTrigger: (name: string) => void
  triggering: string | null
}) {
  const last = job.lastExecution
  const isRunning = last?.status === 'running'

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 font-mono">{job.name}</p>
            {!job.enabled && <SeverityBadge level="neutral" label="disabled" />}
            {isRunning && (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                running
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{job.description}</p>
          <p className="text-xs text-slate-400 mt-1">{job.scheduleLabel}</p>
        </div>
        <Button
          size="xs"
          variant="secondary"
          loading={triggering === job.name}
          onClick={() => onTrigger(job.name)}
          disabled={!job.enabled || isRunning}
        >
          Run now
        </Button>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-slate-400">Last run</p>
          <p className="text-xs font-medium text-slate-700 mt-0.5">{fmtRelative(last?.started_at ?? null)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Duration</p>
          <p className="text-xs font-medium text-slate-700 mt-0.5">{fmtDuration(last?.duration_ms ?? null)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">7d success</p>
          <p className={`text-xs font-bold mt-0.5 ${job.successRate === null ? 'text-slate-400' : job.successRate === 100 ? 'text-emerald-600' : job.successRate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
            {job.successRate === null ? '—' : `${job.successRate}%`}
          </p>
        </div>
      </div>

      {last && (
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={last.status} />
          {last.error_message && (
            <p className="text-xs text-red-500 truncate flex-1">{last.error_message}</p>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Execution row ─────────────────────────────────────────────────────────────

function ExecutionRow({ row, onRetry, retrying }: {
  row: JobExecutionRow
  onRetry: (id: string, jobName: string) => void
  retrying: string | null
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
      <td className="py-2.5 px-3 font-mono text-xs text-slate-700">{row.job_name}</td>
      <td className="py-2.5 px-3"><StatusBadge status={row.status} /></td>
      <td className="py-2.5 px-3 text-slate-500 text-xs">{fmtDate(row.started_at)}</td>
      <td className="py-2.5 px-3 text-slate-500 text-xs">{fmtDuration(row.duration_ms)}</td>
      <td className="py-2.5 px-3 text-xs">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.triggered_by === 'cron' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700'}`}>
          {row.triggered_by}
        </span>
      </td>
      <td className="py-2.5 px-3 text-xs text-red-500 max-w-xs truncate">{row.error_message ?? '—'}</td>
      <td className="py-2.5 px-3">
        {row.status === 'failed' && (
          <Button
            size="xs"
            variant="ghost"
            loading={retrying === row.id}
            onClick={() => onRetry(row.id, row.job_name)}
          >
            Retry
          </Button>
        )}
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobsDashboardPage() {
  const [data,       setData]       = useState<JobsResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [retrying,   setRetrying]   = useState<string | null>(null)
  const [toast,      setToast]      = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/system/jobs?limit=100')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleTrigger(jobName: string) {
    setTriggering(jobName)
    try {
      const res = await fetch('/api/admin/system/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobName }),
      })
      if (!res.ok) {
        const { error: e } = await res.json()
        showToast('error', e ?? 'Trigger failed')
      } else {
        showToast('success', `${jobName} triggered successfully`)
        setTimeout(() => void load(), 1500)  // refresh after brief delay
      }
    } catch {
      showToast('error', 'Network error — could not trigger job')
    } finally {
      setTriggering(null)
    }
  }

  async function handleRetry(execId: string, jobName: string) {
    setRetrying(execId)
    try {
      const res = await fetch(`/api/admin/system/jobs/${execId}/retry`, { method: 'POST' })
      if (!res.ok) {
        const { error: e } = await res.json()
        showToast('error', e ?? 'Retry failed')
      } else {
        showToast('success', `${jobName} retry queued`)
        setTimeout(() => void load(), 1500)
      }
    } catch {
      showToast('error', 'Network error — could not retry job')
    } finally {
      setRetrying(null)
    }
  }

  const stuck = data?.stuckJobs ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Orchestration"
        subtitle="Monitor, trigger, and retry background jobs."
        actions={
          <Button size="sm" variant="secondary" onClick={() => void load()} loading={loading}>
            Refresh
          </Button>
        }
      />

      {toast && (
        <OperationalBanner
          type={toast.type === 'success' ? 'success' : 'critical'}
          message={toast.message}
          dismissible
        />
      )}

      {error && (
        <OperationalBanner type="warning" message={error} detail="Try refreshing the page." dismissible />
      )}

      {stuck.length > 0 && (
        <OperationalBanner
          type="critical"
          message={`${stuck.length} stuck job${stuck.length > 1 ? 's' : ''} detected`}
          detail={stuck.map(j => `${j.jobName} (${j.runningMinutes} min)`).join(', ')}
        />
      )}

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton variant="kpi" count={4} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="card" count={1} />)}
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          {data?.stats && (
            <MetricGrid cols={4}>
              <MetricCard label="Jobs Today"    value={data.stats.totalToday}   colour="slate" />
              <MetricCard label="Succeeded"     value={data.stats.successToday} colour="emerald" />
              <MetricCard label="Failed"        value={data.stats.failedToday}  colour={data.stats.failedToday > 0 ? 'red' : 'slate'} />
              <MetricCard label="Skipped"       value={data.stats.skippedToday} colour="slate" />
            </MetricGrid>
          )}

          {/* Job cards */}
          <div>
            <SectionHeader title="Registered Jobs" className="mb-3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.jobs.map(job => (
                <JobCard
                  key={job.name}
                  job={job}
                  onTrigger={handleTrigger}
                  triggering={triggering}
                />
              ))}
              {!data?.jobs.length && (
                <EmptyState message="No jobs registered" />
              )}
            </div>
          </div>

          {/* Execution history */}
          <div>
            <SectionHeader title="Recent Executions" className="mb-3" />
            {(data?.recentExecutions.length ?? 0) === 0 ? (
              <EmptyState message="No executions recorded yet" />
            ) : (
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {['Job', 'Status', 'Started', 'Duration', 'Trigger', 'Error', ''].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-slate-500 py-2.5 px-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.recentExecutions.map(row => (
                        <ExecutionRow
                          key={row.id}
                          row={row}
                          onRetry={handleRetry}
                          retrying={retrying}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
