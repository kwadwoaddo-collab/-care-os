'use client'

import Link from 'next/link'
import { useEffect, useId } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const instanceId = useId()
  const incidentRef = error.digest
    ? `ERR-${error.digest.slice(0, 8).toUpperCase()}`
    : `ERR-UNKNOWN`

  useEffect(() => {
    console.error('[global/error]', {
      message: error.message,
      digest: error.digest,
      incidentRef,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })
  }, [error, incidentRef])

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-[#fbf8fa] text-[#1b1b1d] dark:bg-[#0f0f10] dark:text-[#fcf8f9]">
          <div className="w-16 h-16 rounded-full bg-red-100 border-2 border-red-200 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold mb-2 font-jakarta">
            System Error
          </h1>
          <p className="text-sm opacity-80 max-w-sm mb-4 font-inter">
            Care OS encountered an unexpected problem. Our team has been notified. 
          </p>

          <p className="text-xs font-mono mb-8 opacity-60 select-all p-2 bg-black/5 dark:bg-white/5 rounded">
            Ref: {incidentRef}
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Reload Page
            </button>
            <Link
              href="/admin"
              className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
