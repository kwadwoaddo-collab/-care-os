import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin }  from '@/lib/auth/requireAdmin'
import { can }           from '@/lib/auth/permissions'
import { forbidden }     from '@/lib/auth/responses'
import { canRetry }      from '@/lib/jobs/executor'

// POST /api/admin/system/jobs/[id]/retry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'system:write')) return forbidden('Insufficient permissions')

  const { id: execId } = await params
  const { allowed, row } = await canRetry(execId)

  if (!allowed) {
    return NextResponse.json(
      { error: row ? `Cannot retry — status is ${row.status} (retries: ${row.retry_count}/${row.max_retries})` : 'Execution not found' },
      { status: 400 },
    )
  }

  // Trigger via the cron route, incrementing the retry count
  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const slug     = row!.job_name.replace(/_/g, '-')
  const response = await fetch(`${baseUrl}/api/cron/${slug}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${cronSecret}` },
  })

  if (!response.ok) {
    const text = await response.text()
    return NextResponse.json({ error: `Retry failed: ${response.status} — ${text}` }, { status: 500 })
  }

  const result = await response.json()
  return NextResponse.json({ retried: true, originalExecutionId: execId, result })
}
