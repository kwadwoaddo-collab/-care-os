import { Skeleton } from '@/components/ui'

export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="w-40 h-6 bg-slate-200 rounded animate-pulse" />
          <div className="w-64 h-4 bg-slate-100 rounded animate-pulse mt-2" />
        </div>
      </div>
      <Skeleton variant="kpi" count={4} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="card" count={1} />)}
      </div>
    </div>
  )
}
