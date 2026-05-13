'use client'

import { useState, useEffect, useCallback } from 'react'
import AuditLogMobile from '@/components/admin/AuditLogMobile'
import AuditLogDesktop from '@/components/admin/AuditLogDesktop'
import type { AuditEntry } from '@/components/admin/AuditLogMobile'

export default function AuditLogContent() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'today', 'staff', 'shift', 'document'
  const [searchEntityId, setSearchEntityId] = useState('')
  const [appliedSearchEntityId, setAppliedSearchEntityId] = useState('')

  // Pagination state
  const [limit, setLimit] = useState(50)
  const [hasMore, setHasMore] = useState(true)

  const fetchLogs = useCallback(async (filterAction: string, entityId: string, currentLimit: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterAction && filterAction !== 'all') {
        if (filterAction === 'today') {
          // Special case: we don't have a date filter on the API yet, so we just fetch normal and filter locally, 
          // or we just fetch default. For now, let's skip API date filtering and handle action filtering.
        } else {
          params.set('action', filterAction)
        }
      }
      if (entityId) params.set('entity_id', entityId)
      params.set('limit', currentLimit.toString())

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      
      let data = await res.json() as AuditEntry[]
      
      // Local filtering for 'today' if needed
      if (filterAction === 'today') {
        const todayStr = new Date().toISOString().split('T')[0]
        data = data.filter(e => e.created_at.startsWith(todayStr))
      }

      setEntries(data)
      setHasMore(data.length >= currentLimit) // If we got as many as we asked for, there might be more
    } catch {
      setError('Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load & when filter/limit changes
  useEffect(() => {
    void fetchLogs(activeFilter, appliedSearchEntityId, limit)
  }, [fetchLogs, activeFilter, appliedSearchEntityId, limit])

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter)
    setLimit(50) // reset pagination
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedSearchEntityId(searchEntityId.trim())
    setLimit(50) // reset pagination
  }

  const handleClearFilters = () => {
    setActiveFilter('all')
    setSearchEntityId('')
    setAppliedSearchEntityId('')
    setLimit(50)
  }

  const handleLoadMore = () => {
    setLimit(prev => prev + 50)
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="h-full">
      {/* Mobile View */}
      <div className="block lg:hidden h-full">
        <AuditLogMobile 
          entries={entries}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block">
        <AuditLogDesktop 
          entries={entries}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          searchEntityId={searchEntityId}
          onSearchEntityIdChange={setSearchEntityId}
          onSearchSubmit={handleSearchSubmit}
          onClearFilters={handleClearFilters}
        />
      </div>
    </div>
  )
}
