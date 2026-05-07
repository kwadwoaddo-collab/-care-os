import Link from 'next/link'
import type { ReactNode } from 'react'

const NAV = [
  { href: '/worker/dashboard',    label: 'Dashboard' },
  { href: '/worker/shifts',       label: 'Shifts' },
  { href: '/worker/availability', label: 'Availability' },
  { href: '/worker/documents',    label: 'Documents' },
]

export default function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight">Care OS Worker Portal</span>
        </div>
        <nav className="max-w-4xl mx-auto px-4 pb-0 flex gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-t-md transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Page */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
