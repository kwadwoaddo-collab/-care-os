'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { can } from '@/lib/rbac/permissions'
import {
  canViewCompliance,
  canViewIncidents,
  canViewAuditLogs,
  canViewSystemHealth,
  canManageStaff,
} from '@/lib/rbac/can'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminMobileNavProps {
  userRole: string
}

interface NavItem {
  href:  string
  label: string
  icon:  string  // key for renderIcon
  match: (pathname: string) => boolean
}

// ── SVG icon set (outline style, 24px) ────────────────────────────────────────

function IconDashboard({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.75}>
      {filled ? (
        <>
          <rect x="3" y="3" width="8" height="9" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="14" width="8" height="7" rx="1.5" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="8" height="9" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="14" width="8" height="7" rx="1.5" />
        </>
      )}
    </svg>
  )
}

function IconApplicants({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  )
}

function IconStaff({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      {filled && <path d="M19 8l2 2-5 5" strokeWidth={2} stroke="currentColor" fill="none" />}
    </svg>
  )
}

function IconCompliance({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l7 4v6c0 4.5-3 8.5-7 10C5 20.5 2 16.5 2 12V6l10-4z" fill={filled ? 'currentColor' : 'none'} />
      <path d="M9 12l2 2 4-4" stroke={filled ? 'white' : 'currentColor'} />
    </svg>
  )
}

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <circle cx="5"  cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )
}

// ── More drawer icon set (smaller, 20px) ──────────────────────────────────────

function IconOnboarding() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8l2 2-5 5" strokeWidth={2} />
    </svg>
  )
}

function IconDocuments() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  )
}

function IconTraining() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconIncidents() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

function IconAudit() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  )
}

function IconSystem() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

// ── More Drawer ────────────────────────────────────────────────────────────────

interface MoreItem {
  href:  string
  label: string
  icon:  React.ReactNode
}

function MoreDrawer({ items, onClose }: { items: MoreItem[]; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="fixed bottom-20 left-0 right-0 z-50 bg-surface-container-lowest rounded-t-2xl shadow-2xl border-t border-gray-100 pb-safe animate-in slide-in-from-bottom duration-200">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-3 mb-4" />
        
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-5 mb-2">
          More sections
        </p>

        <div className="divide-y divide-gray-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-4 px-5 py-3.5 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <span className="text-gray-500">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
              <svg className="ml-auto w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>

        <div className="border-t border-gray-100 mt-1">
          <Link
            href="/admin/logout"
            onClick={onClose}
            className="flex items-center gap-4 px-5 py-3.5 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <IconLogout />
            <span className="text-sm font-medium">Sign out</span>
          </Link>
        </div>

        <div className="h-safe" />
      </div>
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminMobileNav({ userRole }: AdminMobileNavProps) {
  const pathname    = usePathname()
  const [open, setOpen] = useState(false)

  // Hide on auth pages
  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/set-password'
  if (isAuthPage || !userRole) return null

  // ── Build primary tabs (4 tabs + More) ─────────────────────────────────────

  const allPrimary: (NavItem & { allowed: boolean })[] = [
    {
      href:    '/admin',
      label:   'Home',
      icon:    'dashboard',
      match:   (p) => p === '/admin',
      allowed: true,
    },
    {
      href:    '/admin/applicants',
      label:   'Recruitment',
      icon:    'applicants',
      match:   (p) =>
        p.startsWith('/admin/applicants') ||
        p.startsWith('/admin/onboarding/pipeline'),
      allowed: can(userRole, 'applicants:read'),
    },
    {
      href:    '/admin/staff',
      label:   'Staff',
      icon:    'staff',
      match:   (p) =>
        p.startsWith('/admin/staff') ||
        p.startsWith('/admin/onboarding'),
      allowed: canManageStaff(userRole),
    },
    {
      href:    '/admin/compliance',
      label:   'Compliance',
      icon:    'compliance',
      match:   (p) => p.startsWith('/admin/compliance'),
      allowed: canViewCompliance(userRole),
    },
  ]

  const primaryTabs = allPrimary.filter((t) => t.allowed)

  // ── Build More drawer items (Phase 1 only) ─────────────────────────────────

  const moreItems: MoreItem[] = [
    canManageStaff(userRole)        && { href: '/admin/onboarding',                   label: 'Onboarding',      icon: <IconOnboarding /> },
    canViewCompliance(userRole)     && { href: '/admin/documents/verification',        label: 'Documents',       icon: <IconDocuments /> },
    canViewCompliance(userRole)     && { href: '/admin/compliance/training-matrix',    label: 'Training Matrix', icon: <IconTraining /> },
    canViewIncidents(userRole)      && { href: '/admin/incidents',                     label: 'Incidents',       icon: <IconIncidents /> },
    canViewAuditLogs(userRole)      && { href: '/admin/audit-log',                     label: 'Audit Log',       icon: <IconAudit /> },
    canViewSystemHealth(userRole)   && { href: '/admin/system',                        label: 'System Health',   icon: <IconSystem /> },
  ].filter(Boolean) as MoreItem[]

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderIcon(icon: string, active: boolean) {
    const props = { filled: active }
    if (icon === 'dashboard')   return <IconDashboard  {...props} />
    if (icon === 'applicants')  return <IconApplicants {...props} />
    if (icon === 'staff')       return <IconStaff      {...props} />
    if (icon === 'compliance')  return <IconCompliance {...props} />
    return null
  }

  return (
    <>
      {/* Bottom nav bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-surface-container-highest shadow-[0_-4px_20px_-2px_rgba(0,0,0,0.05)] rounded-t-xl pb-safe"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-around items-center h-20 px-margin-mobile">
          {primaryTabs.map((tab) => {
            const active = tab.match(pathname)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  'flex flex-col items-center justify-center py-1.5 px-4 rounded-full transition-transform duration-150 active:scale-90 cursor-pointer',
                  active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:text-primary transition-colors',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                {renderIcon(tab.icon, active)}
                <span className="font-label-md text-label-md mt-0.5">{tab.label}</span>
              </Link>
            )
          })}

          {/* More tab */}
          <button
            onClick={() => setOpen(!open)}
            className={[
              'flex flex-col items-center justify-center py-1.5 px-4 rounded-full transition-transform duration-150 active:scale-90 cursor-pointer',
              open ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:text-primary transition-colors',
            ].join(' ')}
            aria-label={open ? 'Close more navigation options' : 'Open more navigation options'}
            aria-expanded={open}
            aria-haspopup="true"
          >
            <IconMore />
            <span className="font-label-md text-label-md mt-0.5" aria-hidden="true">More</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      {open && <MoreDrawer items={moreItems} onClose={() => setOpen(false)} />}
    </>
  )
}
