// lib/auth/permissions.ts
//
// DEPRECATED: Prefer importing from '@/lib/rbac/permissions' or '@/lib/rbac/can'.
// This file re-exports from lib/rbac/permissions for backwards compatibility.
// All application code written after the RBAC sprint should use lib/rbac/.

export {
  PERMISSIONS,
  type Permission,
  can,
  getRolePermissions,
} from '@/lib/rbac/permissions'
