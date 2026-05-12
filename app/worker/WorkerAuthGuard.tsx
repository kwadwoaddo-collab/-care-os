'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Client-side auth guard for the worker portal.
 * Checks for token existence and redirects to login if missing.
 * Also handles token invalidation from the API.
 */
export default function WorkerAuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Skip for login page
    if (pathname === '/worker/login') {
      setReady(true)
      return
    }

    const token = sessionStorage.getItem('worker_token')
    if (!token) {
      console.log('[WorkerAuthGuard] No token found. Redirecting to login.')
      router.replace('/worker/login?expired=1')
      return
    }

    // Optional: Periodic validation check could go here
    setReady(true)
  }, [pathname, router])

  if (!ready && pathname !== '/worker/login') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
