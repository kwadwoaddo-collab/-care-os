export default function ShiftsLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="h-7 bg-gray-100 rounded-lg w-32 animate-pulse" />

      {/* Filter tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 bg-gray-100 rounded-full animate-pulse" />
        ))}
      </div>

      {/* Shift card skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-surface-container-lowest rounded-xl border border-gray-200 p-4 space-y-3 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1.5 flex-1">
              <div className="h-5 bg-gray-100 rounded w-3/5" />
              <div className="h-4 bg-gray-100 rounded w-2/5" />
            </div>
            <div className="h-6 w-20 bg-gray-100 rounded-full" />
          </div>
          <div className="flex gap-2">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
