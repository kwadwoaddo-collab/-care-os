/**
 * PageHeader — standardised page header with breadcrumb, title, subtitle, and actions.
 *
 * Replaces 20+ ad-hoc heading patterns across admin pages.
 *
 * Usage:
 *   <PageHeader title="Communications" subtitle="Operational messaging." />
 *   <PageHeader
 *     breadcrumb={[{ label: 'Analytics', href: '/admin/analytics' }, { label: 'Workforce' }]}
 *     title="Workforce Performance"
 *     subtitle="30-day rolling window."
 *     actions={<Link href="...">+ New</Link>}
 *   />
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title:       string
  subtitle?:   string
  breadcrumb?: BreadcrumbItem[]
  actions?:    ReactNode
  className?:  string
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap ${className}`}>
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500 mb-2">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                {item.href ? (
                  <Link href={item.href} className="hover:text-indigo-600 transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-slate-800 font-medium" aria-current="page">
                    {item.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
