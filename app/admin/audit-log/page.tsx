import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'
import AuditLogContent from './AuditLogContent'

export const metadata = { title: 'Audit Log — Care OS' }

export default async function AuditLogPage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'audit_log:read')) return <AccessDenied />

  return <AuditLogContent />
}
