import { Suspense } from 'react'
import LoginClient from './LoginClient'

export default async function WorkerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <LoginClient token={token ?? ''} />
    </Suspense>
  )
}
