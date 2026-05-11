'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const NAV = [
  { href: '/worker/dashboard',    label: 'Home',         icon: '🏠' },
  { href: '/worker/onboarding',   label: 'Onboarding',   icon: '✅' },
  { href: '/worker/documents',    label: 'Documents',    icon: '📄' },
  { href: '/worker/shifts',       label: 'Shifts',       icon: '📅' },
  { href: '/worker/availability', label: 'Availability', icon: '🗓' },
]

export default function WorkerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header bar */}
      <header className="bg-gray-900 text-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">Care OS</span>
          <span className="text-xs text-gray-400">Worker Portal</span>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav
        className="sticky bottom-0 z-30 bg-white border-t border-gray-200 shadow-lg"
        aria-label="Worker navigation"
      >
        <div className="max-w-2xl mx-auto flex">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== '/worker/dashboard' && pathname.startsWith(n.href))
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors min-h-[56px] justify-center',
                  active
                    ? 'text-indigo-600 bg-indigo-50/60'
                    : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50/40',
                ].join(' ')}
              >
                <span className="text-lg leading-none" aria-hidden="true">{n.icon}</span>
                <span className={`text-[11px] font-medium ${active ? 'text-indigo-700' : ''}`}>{n.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
