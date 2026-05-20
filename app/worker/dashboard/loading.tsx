export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* Hero greeting skeleton */}
      <div className="space-y-2">
        <div className="h-7 bg-gray-100 rounded-lg w-48 animate-pulse" />
        <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
      </div>

      {/* Status card skeleton */}
      <div className="bg-gray-100 rounded-xl h-20 animate-pulse" />

      {/* Alert banners */}
      <div className="space-y-2">
        <div className="bg-gray-100 rounded-xl h-12 animate-pulse" />
      </div>

      {/* Upcoming shifts section */}
      <div className="space-y-3">
        <div className="h-5 bg-gray-100 rounded w-36 animate-pulse" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-surface-container-lowest rounded-xl border border-gray-200 p-4 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1.5 flex-1">
                <div className="h-5 bg-gray-100 rounded w-3/5" />
                <div className="h-4 bg-gray-100 rounded w-2/5" />
              </div>
              <div className="h-6 w-20 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick links grid */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  )
}
