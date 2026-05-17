/**
 * EmptyState — standardised zero-data placeholder.
 *
 * Replaces 33+ instances of ad-hoc "no items yet" divs scattered across pages.
 *
 * Usage:
 *   <EmptyState message="No visits today." />
 *   <EmptyState message="No messages." action={{ label: '+ New', href: '/...' }} />
 *   <EmptyState icon="📭" message="You're all caught up." />
 */

import Link from 'next/link'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  message:     string
  submessage?: string
  icon?:       string          // emoji or React node as string
  action?:     EmptyStateAction
  compact?:    boolean          // smaller padding for inline use
  className?:  string
}

export default function EmptyState({
  message,
  submessage,
  icon = '📭',
  action,
  compact = false,
  className = '',
}: EmptyStateProps) {
  const padding = compact ? 'py-10' : 'py-16'

  return (
    <div className={`flex flex-col items-center text-center ${padding} px-6 ${className}`}>
      {icon && (
        <span className="text-4xl mb-3 select-none" aria-hidden="true">{icon}</span>
      )}
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {submessage && (
        <p className="text-xs text-slate-400 mt-1 max-w-xs">{submessage}</p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className="text-sm text-indigo-600 font-medium hover:text-indigo-800 hover:underline"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="text-sm text-indigo-600 font-medium hover:text-indigo-800 hover:underline"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
