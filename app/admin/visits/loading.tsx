import Skeleton from '@/components/ui/Skeleton'
import { SkeletonTable } from '@/components/ui/Skeleton'

export default function VisitsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-60 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
      <Skeleton variant="kpi" count={8} />
      <SkeletonTable rows={5} cols={6} />
      <SkeletonTable rows={3} cols={6} />
    </div>
  )
}
