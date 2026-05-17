import Skeleton from '@/components/ui/Skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-8 w-14 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
      {/* Health + Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="h-24 w-24 bg-slate-100 rounded-full animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
        <Skeleton variant="card" count={1} />
      </div>
      {/* KPI grid */}
      <Skeleton variant="kpi" count={12} />
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
            <div className="h-24 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
