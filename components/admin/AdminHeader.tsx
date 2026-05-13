'use client'

import { usePathname } from 'next/navigation'
import AdminNotificationBell from '@/components/shared/AdminNotificationBell'
import ThemeToggle from './ThemeToggle'

export default function AdminHeader() {
  const pathname = usePathname()

  // Hide header on login and set-password pages
  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/set-password'
  if (isAuthPage) return null

  return (
    <header className="h-16 w-full sticky top-0 z-40 bg-surface-container/90 dark:bg-surface-container-high/90 backdrop-blur-md flex justify-between items-center px-6 transition-colors">
      
      {/* Mobile Brand (Hidden on Desktop where Sidebar handles it) */}
      <div className="lg:hidden flex items-center gap-3">
        <span className="font-headline-md text-headline-md font-bold text-primary dark:text-inverse-primary tracking-tight">Care OS</span>
      </div>

      {/* Desktop Search (Visual Placeholder) */}
      <div className="hidden lg:flex items-center gap-4 flex-1">
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[20px]" data-icon="search">search</span>
          </span>
          <input 
            type="text" 
            placeholder="Search system components..." 
            className="bg-surface-container-low dark:bg-inverse-surface border-none rounded-full py-2 pl-10 pr-4 text-body-md w-64 focus:ring-2 focus:ring-secondary transition-all placeholder:text-on-surface-variant dark:text-on-surface"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <AdminNotificationBell />
        <div className="h-8 w-[1px] bg-outline-variant dark:bg-outline mx-2 hidden sm:block"></div>
        <a
          href="/admin/logout"
          className="text-sm font-medium text-on-surface-variant hover:text-primary dark:hover:text-inverse-primary transition-colors ml-1"
        >
          Logout
        </a>
      </div>
    </header>
  )
}
