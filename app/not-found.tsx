import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 bg-background">
      <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-primary mb-2 tracking-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
        Page not found
      </h1>
      <p className="text-sm text-on-surface-variant max-w-sm mb-8" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
        We couldn't find the page you're looking for. It might have been moved or the URL may be incorrect.
      </p>

      <Link
        href="/admin"
        className="px-6 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
