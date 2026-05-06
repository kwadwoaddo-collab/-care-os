import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { reviewed_by?: string; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('staff_profiles')
    .update({
      last_reviewed_at:  new Date().toISOString(),
      last_reviewed_by:  body.reviewed_by ?? null,
      last_review_notes: body.notes ?? null,
    })
    .eq('id', id)
    .select('last_reviewed_at, last_reviewed_by, last_review_notes')
    .maybeSingle()

  if (error) {
    console.error('[staff/review] update error:', error.message)
    return NextResponse.json(
      { error: 'Failed to save review', supabase_message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
