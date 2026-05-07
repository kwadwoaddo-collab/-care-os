import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

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
    .eq('company_id', companyId)
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
