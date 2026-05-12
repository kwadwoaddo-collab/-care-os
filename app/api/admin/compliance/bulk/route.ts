import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'

// ── POST /api/admin/compliance/bulk ──────────────────────────────────────────
//
// Bulk compliance actions on a subset of staff.
//
// Body:
//   action:   'send_reminder'     — delegates to /api/admin/compliance/reminders/worker
//   staffIds: string[]            — required, list of staff profile IDs
//   dry_run?: boolean
//
// The route is a thin router — actual logic lives in the specific sub-routes so
// each can be used independently as well.

interface BulkBody {
  action:    'send_reminder'
  staffIds:  string[]
  dry_run?:  boolean
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')

  const body: BulkBody = await request.json().catch(() => ({}))

  if (!body.action || !Array.isArray(body.staffIds) || body.staffIds.length === 0) {
    return NextResponse.json(
      { error: 'action and staffIds[] are required' },
      { status: 400 }
    )
  }

  if (body.action === 'send_reminder') {
    // Delegate to worker reminder route with the exact staffIds
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Forward cookies so requireAdmin works inside the sub-call
    const cookieHeader = request.headers.get('cookie') ?? ''
    const res = await fetch(`${baseUrl}/api/admin/compliance/reminders/worker`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie':        cookieHeader,
      },
      body: JSON.stringify({
        staffIds: body.staffIds,
        dry_run:  body.dry_run ?? false,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(err, { status: res.status })
    }

    return NextResponse.json(await res.json())
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
}
