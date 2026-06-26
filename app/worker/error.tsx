'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function WorkerError({ error, reset }: Props) {
  const incidentRef = error.digest
    ? `ERR-${error.digest.slice(0, 8).toUpperCase()}`
    : `ERR-UNKNOWN`

  useEffect(() => {
    console.error('[worker/error]', {
      message:     error.message,
      digest:      error.digest,
      incidentRef,
      timestamp:   new Date().toISOString(),
    })
  }, [error, incidentRef])

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mb-5">
        <svg
          className="w-8 h-8 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <h1 className="text-lg font-semibold text-gray-900 mb-1">
        Something went wrong
      </h1>
      <p className="text-sm text-gray-500 max-w-xs mb-2">
        We couldn&apos;t load this page. Please try again — your data is safe.
      </p>

      <p className="text-xs text-gray-400 font-mono mb-5 select-all" title="Quote this reference if you contact support">
        Ref: {incidentRef}
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          id="worker-error-retry-btn"
          onClick={reset}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 active:scale-95 transition-all"
        >
          Try again
        </button>
        <a
          id="worker-error-dashboard-link"
          href="/worker/dashboard"
          className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center transition-colors"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  )
}
