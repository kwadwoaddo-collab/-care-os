import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normaliseRole } from '@/lib/rbac/roles'
import { can } from '@/lib/rbac/permissions'
import { ENABLE_ONBOARDING_CHECKLISTS } from '@/lib/features'
import ChecklistTemplatesClient from './ChecklistTemplatesClient'

export const metadata: Metadata = {
  title: 'Checklist Templates | Care OS',
  description: 'Role-based onboarding checklist templates.',
}

export default async function ChecklistTemplatesPage() {
  if (!ENABLE_ONBOARDING_CHECKLISTS) redirect('/admin/onboarding')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const userRole = normaliseRole((profile?.role as string | null) ?? '')
  if (!can(userRole, 'staff:read')) redirect('/admin')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Checklist Templates</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Define role-based onboarding checklists to assign to new hires.
          </p>
        </div>
      </div>

      <ChecklistTemplatesClient canWrite={can(userRole, 'staff:write')} />
    </div>
  )
}
