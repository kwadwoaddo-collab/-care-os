'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { can } from '@/lib/rbac/permissions'
import Icon from '@/components/ui/Icon'
import {
  canViewCompliance,
  canViewAuditLogs,
  canViewIncidents,
  canManageStaff,
  canViewSystemHealth,
  canManageTenants,
} from '@/lib/rbac/can'

interface AdminSidebarProps {
  userRole: string
  userFullName: string
  userInitials: string
}

export default function AdminSidebar({ userRole, userFullName, userInitials }: AdminSidebarProps) {
  const pathname = usePathname()

  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/set-password'
  if (isAuthPage) return null

  const showAll = !userRole
  function navCan(check: (role: string) => boolean): boolean {
    return showAll || check(userRole)
  }

  // ── Primary nav items (Phase 1 core) ──────────────────────────────────────
  const primaryItems = [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: 'dashboard',
      show: true,
    },
    {
      label: 'Recruitment',
      href: '/admin/applicants',
      icon: 'person_search',
      show: navCan((r) => can(r, 'applicants:read')),
      activeMatch: (p: string) => p.startsWith('/admin/applicants'),
    },
    {
      label: 'Onboarding',
      href: '/admin/onboarding',
      icon: 'how_to_reg',
      show: navCan(canManageStaff),
      activeMatch: (p: string) =>
        p.startsWith('/admin/onboarding') && !p.startsWith('/admin/onboarding/pipeline'),
    },
    {
      label: 'Staff',
      href: '/admin/staff',
      icon: 'group',
      show: navCan(canManageStaff),
      activeMatch: (p: string) => p.startsWith('/admin/staff'),
    },
    {
      label: 'Compliance',
      href: '/admin/compliance',
      icon: 'verified_user',
      show: navCan(canViewCompliance),
      activeMatch: (p: string) =>
        p.startsWith('/admin/compliance'),
    },
    {
      label: 'Documents',
      href: '/admin/documents/verification',
      icon: 'folder_open',
      show: navCan(canViewCompliance),
      activeMatch: (p: string) => p.startsWith('/admin/documents'),
    },
  ]

  // ── Secondary nav items (below divider, muted) ────────────────────────────
  const secondaryItems = [
    {
      label: 'Training Matrix',
      href: '/admin/compliance/training-matrix',
      icon: 'grid_view',
      show: navCan(canViewCompliance),
      activeMatch: (p: string) => p.startsWith('/admin/compliance/training-matrix'),
    },
    {
      label: 'Incidents',
      href: '/admin/incidents',
      icon: 'warning',
      show: navCan(canViewIncidents),
    },
    {
      label: 'Audit Log',
      href: '/admin/audit-log',
      icon: 'history',
      show: navCan(canViewAuditLogs),
    },
  ]

  // ── Footer items ───────────────────────────────────────────────────────────
  const footerItems = [
    { label: 'Analytics', href: '/admin/analytics',       icon: 'analytics',      show: navCan(canViewCompliance) },
    { label: 'Tenants',   href: '/admin/system/tenants',  icon: 'corporate_fare', show: navCan(canManageTenants) },
    { label: 'Jobs',      href: '/admin/system/jobs',     icon: 'manufacturing',  show: navCan(canViewSystemHealth) },
    { label: 'System',    href: '/admin/system',           icon: 'settings',       show: navCan(canViewSystemHealth) },
  ]

  // Helper: is a given nav item currently active?
  function isActive(item: { href: string; activeMatch?: (p: string) => boolean }): boolean {
    if (item.activeMatch) return item.activeMatch(pathname)
    return pathname === item.href ||
      (item.href !== '/admin' && pathname.startsWith(item.href))
  }

  function NavLink({ item, muted = false }: {
    item: { label: string; href: string; icon: string; show: boolean; activeMatch?: (p: string) => boolean }
    muted?: boolean
  }) {
    const active = isActive(item)
    return (
      <Link
        href={item.href}
        className={`relative flex items-center gap-4 px-4 py-2.5 rounded-lg transition-all duration-200 overflow-hidden ${
          active
            ? 'bg-secondary text-white shadow-sm'
            : muted
              ? 'text-on-surface-variant/70 hover:bg-surface-container-high hover:text-on-surface'
              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
        }`}
        style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
      >
        {active && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
        )}
        <Icon
          name={item.icon}
          size={muted ? 'sm' : 'md'}
          fill={active}
          className="shrink-0"
        />
        <span className={`truncate normal-case ${muted ? 'text-xs font-medium' : 'text-sm font-medium'}`}>
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 min-w-[256px] max-w-[256px] fixed left-0 top-0 bg-surface-container border-r border-outline-variant z-50">
      <div className="flex flex-col h-full px-6 py-8 overflow-y-auto no-scrollbar">

        {/* ── Brand ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 shrink-0 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Icon name="shield" size="md" fill className="text-on-primary" />
          </div>
          <div>
            <span
              className="block text-[22px] font-bold text-on-surface leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
            >
              Care OS
            </span>
            <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">
              Healthcare Admin
            </span>
          </div>
        </div>

        {/* ── Primary Navigation ─────────────────────────────────────────────── */}
        <nav className="flex-1 flex flex-col" aria-label="Primary navigation">
          <div className="space-y-1.5">
            {primaryItems.filter((i) => i.show).map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          {/* ── Divider + Secondary Navigation ─────────────────────────────── */}
          {secondaryItems.some((i) => i.show) && (
            <div className="mt-6">
              <div className="flex items-center gap-2 px-2 mb-2">
                <div className="flex-1 h-px bg-outline-variant/40" />
                <span className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-widest">
                  More
                </span>
                <div className="flex-1 h-px bg-outline-variant/40" />
              </div>
              <div className="space-y-1">
                {secondaryItems.filter((i) => i.show).map((item) => (
                  <NavLink key={item.href} item={item} muted />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="mt-auto shrink-0 flex flex-col pt-6 gap-2">
          {footerItems.filter((i) => i.show).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 overflow-hidden ${
                  active
                    ? 'bg-secondary text-white shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {active && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
                )}
                <Icon
                  name={item.icon}
                  size="md"
                  fill={active}
                  className="shrink-0"
                />
                <span className="text-sm font-medium normal-case truncate">
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* User profile row */}
          <div className="mt-4 pt-4 border-t border-outline-variant/60 flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-surface-container-lowest shadow-sm border border-outline-variant/60 flex items-center justify-center text-on-surface font-bold text-sm shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold text-on-surface truncate"
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {userFullName}
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium truncate capitalize">
                {userRole.replace(/_/g, ' ') || 'Admin'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
