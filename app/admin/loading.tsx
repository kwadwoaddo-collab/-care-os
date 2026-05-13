// app/admin/loading.tsx
// Shown automatically by Next.js while any admin server component is fetching.

function SkeletonBar({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return (
    <div className={`${w} ${h} rounded-md bg-gray-200 animate-pulse`} />
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4 space-y-3">
      <SkeletonBar w="w-1/3" h="h-3" />
      <SkeletonBar w="w-2/3" h="h-4" />
      <SkeletonBar w="w-1/2" h="h-3" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
      <SkeletonBar w="w-32" h="h-3" />
      <SkeletonBar w="w-24" h="h-3" />
      <SkeletonBar w="w-20" h="h-5" />
      <div className="ml-auto">
        <SkeletonBar w="w-12" h="h-3" />
      </div>
    </div>
  )
}

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-label="Loading…" role="status">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBar w="w-40" h="h-6" />
          <SkeletonBar w="w-24" h="h-3" />
        </div>
        <SkeletonBar w="w-28" h="h-9" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4 space-y-2">
            <SkeletonBar w="w-3/4" h="h-3" />
            <SkeletonBar w="w-1/2" h="h-7" />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <SkeletonBar w="w-64" h="h-9" />
        <SkeletonBar w="w-32" h="h-9" />
        <SkeletonBar w="w-32" h="h-9" />
      </div>

      {/* Table skeleton */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
          {[40, 32, 24, 24, 20].map((w, i) => (
            <SkeletonBar key={i} w={`w-${w}`} h="h-3" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex justify-between items-center">
        <SkeletonBar w="w-32" h="h-4" />
        <div className="flex gap-2">
          <SkeletonBar w="w-8" h="h-8" />
          <SkeletonBar w="w-8" h="h-8" />
          <SkeletonBar w="w-8" h="h-8" />
        </div>
      </div>
    </div>
  )
}
