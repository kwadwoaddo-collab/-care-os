'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import NotificationBell from '@/components/shared/NotificationBell'

function BellInner() {
  const params = useSearchParams()
  const token  = params.get('token') ?? ''

  if (!token) return null
  return <NotificationBell token={token} />
}

export default function NotificationBellWrapper() {
  return (
    <Suspense fallback={null}>
      <BellInner />
    </Suspense>
  )
}
