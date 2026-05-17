import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// GET — list templates (system + company-specific)
export async function GET(_req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { data, error } = await adminClient
    .from('message_templates')
    .select('*')
    .or(`company_id.eq.${companyId},is_system.eq.true`)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ templates: data ?? [] })
}

// POST — create a company-specific template
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const body = await req.json()
  const { name, description, message_type, subject, body: tmplBody, priority = 'normal', channel = 'in_app' } = body

  if (!name || !subject || !tmplBody) {
    return NextResponse.json({ error: 'name, subject, and body are required' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('message_templates')
    .insert({
      company_id:   companyId,
      name:         name.slice(0, 100),
      description:  description?.slice(0, 300) ?? null,
      message_type: message_type ?? 'announcement',
      subject:      subject.slice(0, 250),
      body:         tmplBody.slice(0, 5000),
      priority,
      channel,
      is_system:    false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ template: data }, { status: 201 })
}
