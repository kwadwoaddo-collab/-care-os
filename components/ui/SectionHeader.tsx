/**
 * SectionHeader — standardised section/group header within a page.
 *
 * Usage:
 *   <SectionHeader title="Attendance" />
 *   <SectionHeader title="Recent Incidents" count={12} action={<Link>View all</Link>} />
 */

import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title:      string
  count?:     number
  action?:    ReactNode
  className?: string
}

export default function SectionHeader({ title, count, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
        {title}
        {count !== undefined && (
          <span className="ml-2 font-normal text-slate-400 normal-case">({count})</span>
        )}
      </h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
