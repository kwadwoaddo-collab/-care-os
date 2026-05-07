import { NextRequest, NextResponse } from 'next/server'
import { validateWorkerToken } from '@/lib/worker/auth'

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { worker } = result
  return NextResponse.json({
    id:         worker.id,
    first_name: worker.first_name,
    last_name:  worker.last_name,
    email:      worker.email,
    status:     worker.status,
    job_role:   worker.job_role,
    start_date: worker.start_date,
  })
}
