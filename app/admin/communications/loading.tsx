import { SkeletonTable } from '@/components/ui/Skeleton'
import Skeleton from '@/components/ui/Skeleton'

export default function CommunicationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-60 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-indigo-100 rounded-lg animate-pulse" />
        </div>
      </div>
      <Skeleton variant="kpi" count={5} />
      <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
      <SkeletonTable rows={6} cols={6} />
    </div>
  )
}
