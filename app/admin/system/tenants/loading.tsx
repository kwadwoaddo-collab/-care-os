import Skeleton from '@/components/ui/Skeleton'
import { SkeletonTable } from '@/components/ui/Skeleton'

export default function TenantsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-56 bg-slate-100 rounded animate-pulse" />
      <Skeleton variant="kpi" count={4} />
      <SkeletonTable rows={6} cols={8} />
    </div>
  )
}
