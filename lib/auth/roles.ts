// lib/auth/roles.ts
//
// DEPRECATED: Prefer importing from '@/lib/rbac/roles' directly.
// This file re-exports from lib/rbac/roles for backwards compatibility.
// All application code written after the RBAC sprint should use lib/rbac/.

export {
  ROLES,
  type Role,
  ROLE_HIERARCHY,
  ADMIN_ROLES,
  ASSIGNABLE_ROLES,
  normaliseRole,
  isAdminRole,
  hasRole,
  hierarchyLevel,
} from '@/lib/rbac/roles'
