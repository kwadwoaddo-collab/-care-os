'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import NotificationBellWrapper from '@/components/shared/NotificationBellWrapper'
import WorkerAuthGuard from './WorkerAuthGuard'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'

const NAV = [
  { href: '/worker/dashboard',  label: 'Home',     icon: 'home' },
  { href: '/worker/tasks',      label: 'Tasks',    icon: 'task_alt' },
  { href: '/worker/shifts',     label: 'Shifts',   icon: 'calendar_today' },
  { href: '/worker/messages',   label: 'Messages', icon: 'chat' },
  { href: '/worker/documents',  label: 'Docs',     icon: 'description' },
]

export default function WorkerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const token = sessionStorage.getItem('worker_token')
    try {
      if (token) {
        await fetch('/api/worker/auth/logout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token }),
        })
      }
    } finally {
      sessionStorage.removeItem('worker_token')
      router.replace('/worker/login')
      setLoggingOut(false)
    }
  }

  return (
    <WorkerAuthGuard>
      <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors">
      {/* Header bar */}
      <header className="sticky top-0 z-30 bg-background/80 dark:bg-black/60 backdrop-blur-xl border-b border-black/[0.04] dark:border-white/[0.06] shadow-apple-sm select-none">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0" aria-hidden="true">
              <Icon name="shield" size="sm" fill />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none tracking-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                Care OS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBellWrapper />
            {pathname !== '/worker/login' && (
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-xs text-foreground/60 hover:text-foreground transition-colors font-medium active:scale-95"
              >
                {loggingOut ? '…' : 'Logout'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
        {children}
      </main>

      {/* Bottom tab bar — hidden on login screen */}
      {pathname !== '/worker/login' && <nav
        className="sticky bottom-0 z-30 bg-surface-container-lowest/95 dark:bg-black/75 backdrop-blur-xl border-t border-black/[0.04] dark:border-white/[0.06] shadow-apple-md"
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
                  'flex-1 flex flex-col items-center gap-1 py-3.5 transition-all duration-200 min-h-[56px] justify-center select-none active:scale-[0.96]',
                  active
                    ? 'text-primary bg-primary/5 font-semibold'
                    : 'text-foreground/60 hover:text-primary hover:bg-foreground/5',
                ].join(' ')}
              >
                <Icon name={n.icon} size="md" fill={active} />
                <span className="text-[10px] tracking-wide mt-0.5">{n.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>}
      </div>
    </WorkerAuthGuard>
  )
}
