'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AdminNotificationBell from '@/components/shared/AdminNotificationBell'
import ThemeToggle from './ThemeToggle'
import Icon from '@/components/ui/Icon'

interface StaffResult {
  id: string
  first_name: string | null
  last_name: string | null
  role?: string | null
}

interface ClientResult {
  id: string
  first_name: string | null
  last_name: string | null
  postcode?: string | null
}

const PAGES = [
  { name: 'Dashboard Home', path: '/admin' },
  { name: 'Compliance & Audits', path: '/admin/compliance' },
  { name: 'Workforce Directory', path: '/admin/workforce' },
  { name: 'Shifts Scheduler', path: '/admin/shifts' },
  { name: 'Shift Operations Center', path: '/admin/shifts/operations' },
  { name: 'Incident Intelligence', path: '/admin/incidents' },
  { name: 'Onboarding & Applicants', path: '/admin/onboarding' },
  { name: 'Audit Log Trail', path: '/admin/audit-log' },
]

export default function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<{
    staff: StaffResult[]
    clients: ClientResult[]
  }>({ staff: [], clients: [] })
  
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Hide header on login and set-password pages
  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/set-password'

  // Compute active pages and combined items dynamically
  const activePages = query.trim()
    ? PAGES.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : PAGES

  const displayResults = query.trim()
    ? { staff: searchResults.staff, clients: searchResults.clients, pages: activePages }
    : { staff: [], clients: [], pages: PAGES }

  const allItems = [
    ...displayResults.pages.map(p => ({ type: 'page', name: p.name, path: p.path })),
    ...displayResults.staff.map(s => ({
      type: 'staff',
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unnamed Staff',
      path: `/admin/staff/${s.id}`,
      detail: s.role ? s.role.replace(/_/g, ' ') : 'Staff'
    })),
    ...displayResults.clients.map(c => ({
      type: 'client',
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed Client',
      path: `/admin/clients/${c.id}`,
      detail: c.postcode || 'Client'
    }))
  ]

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle fuzzy searching
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      return
    }

    const controller = new AbortController()
    const { signal } = controller

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true)
      try {
        const [staffRes, clientsRes] = await Promise.all([
          fetch(`/api/admin/staff?search=${encodeURIComponent(query)}&pageSize=5`, { signal }),
          fetch(`/api/admin/clients?search=${encodeURIComponent(query)}&pageSize=5`, { signal })
        ])

        const staffData = staffRes.ok ? await staffRes.json() : { data: [] }
        const clientsData = clientsRes.ok ? await clientsRes.json() : { data: [] }

        setSearchResults({
          staff: staffData.data || [],
          clients: clientsData.data || [],
        })
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Search failed', err)
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false)
          setSelectedIndex(0)
        }
      }
    }, 250)

    return () => {
      clearTimeout(delayDebounce)
      controller.abort()
    }
  }, [query, isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(allItems.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(allItems.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selectedItem = allItems[selectedIndex]
      if (selectedItem) {
        router.push(selectedItem.path)
        setIsOpen(false)
        setQuery('')
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  if (isAuthPage) return null

  return (
    <header className="h-16 w-full sticky top-0 z-40 bg-surface-container flex justify-between items-center px-6 transition-colors">
      
      {/* Mobile Brand (Hidden on Desktop) */}
      <div className="lg:hidden flex items-center gap-3">
        <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">Care OS</span>
      </div>

      {/* Desktop Search */}
      <div ref={containerRef} className="hidden lg:flex items-center gap-4 flex-1 relative">
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-on-surface-variant pointer-events-none">
            <Icon name="search" size="md" />
          </span>
          <input 
            type="text" 
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search staff, clients, documents…"
            className="bg-surface-container-low border-none rounded-full py-2 pl-10 pr-4 text-body-md w-72 focus:ring-2 focus:ring-secondary transition-all placeholder:text-on-surface-variant text-on-surface"
          />

          {/* Autocomplete / Command Palette Dropdown */}
          {isOpen && (
            <div className="absolute top-12 left-0 w-96 max-h-[400px] overflow-y-auto bg-surface-container-highest/95 backdrop-blur-md border border-outline-variant/60 rounded-xl shadow-xl z-50 p-2 divide-y divide-outline-variant/20 scrollbar-none">
              
              {isLoading && (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-on-surface-variant">
                  <span className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
                  Searching databases...
                </div>
              )}

              {/* Pages Section */}
              {displayResults.pages.length > 0 && (
                <div className="py-1">
                  <p className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-3 py-1 tracking-wider">Pages</p>
                  {displayResults.pages.map((p, idx) => {
                    const itemIdx = idx
                    const isSelected = selectedIndex === itemIdx
                    return (
                      <button
                        key={p.path}
                        onClick={() => {
                          router.push(p.path)
                          setIsOpen(false)
                          setQuery('')
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                          isSelected 
                            ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold' 
                            : 'text-on-surface hover:bg-indigo-600/5 hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon name="explore" size="sm" />
                          {p.name}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/60">Go →</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Staff Section */}
              {displayResults.staff.length > 0 && (
                <div className="py-1">
                  <p className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-3 py-1 tracking-wider">Staff Members</p>
                  {displayResults.staff.map((s, idx) => {
                    const itemIdx = displayResults.pages.length + idx
                    const isSelected = selectedIndex === itemIdx
                    const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim()
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          router.push(`/admin/staff/${s.id}`)
                          setIsOpen(false)
                          setQuery('')
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                          isSelected 
                            ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold' 
                            : 'text-on-surface hover:bg-indigo-600/5 hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon name="badge" size="sm" />
                          {fullName}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/60 uppercase">{s.role?.replace(/_/g, ' ') || 'Staff'}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Clients Section */}
              {displayResults.clients.length > 0 && (
                <div className="py-1">
                  <p className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-3 py-1 tracking-wider">Clients</p>
                  {displayResults.clients.map((c, idx) => {
                    const itemIdx = displayResults.pages.length + displayResults.staff.length + idx
                    const isSelected = selectedIndex === itemIdx
                    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim()
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          router.push(`/admin/clients/${c.id}`)
                          setIsOpen(false)
                          setQuery('')
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                          isSelected 
                            ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold' 
                            : 'text-on-surface hover:bg-indigo-600/5 hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon name="folder_shared" size="sm" />
                          {fullName}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/60">{c.postcode || 'No postcode'}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Empty state */}
              {!isLoading && allItems.length === 0 && (
                <div className="px-4 py-3 text-center text-xs text-on-surface-variant">
                  No matching components, staff, or clients found.
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <AdminNotificationBell />
        <div className="h-8 w-[1px] bg-outline-variant mx-2 hidden sm:block"></div>
        <a
          href="/admin/logout"
          className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors ml-1"
        >
          Logout
        </a>
      </div>
    </header>
  )
}
