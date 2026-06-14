'use client'

import { useEffect, useId } from 'react'
import Link from 'next/link'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AdminError({ error, reset }: Props) {
  const instanceId = useId()

  // Generate a stable incident reference from digest or timestamp
  const incidentRef = error.digest
    ? `ERR-${error.digest.slice(0, 8).toUpperCase()}`
    : `ERR-${Date.now().toString(36).toUpperCase()}`

  useEffect(() => {
    console.error('[admin/error]', {
      message:     error.message,
      digest:      error.digest,
      incidentRef,
      stack:       error.stack,
      timestamp:   new Date().toISOString(),
    })
  }, [error, incidentRef])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h1 className="text-lg font-semibold text-primary mb-1">
        Something went wrong
      </h1>
      <p className="text-sm text-on-surface-variant max-w-sm mb-2">
        An unexpected error occurred. You can try again — no data has been lost.
        If the issue persists, contact support with the reference below.
      </p>

      <p className="text-xs text-gray-400 font-mono mb-6 select-all" title="Copy this reference when contacting support">
        Ref: {incidentRef}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          id="admin-error-retry-btn"
          className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/admin"
          id="admin-error-dashboard-link"
          className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>

      {/* Dev-only detail */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-8 max-w-lg w-full text-left">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            Developer details
          </summary>
          <pre className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      )}
    </div>
  )
}
