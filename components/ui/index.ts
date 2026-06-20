/**
 * Care OS UI Component Library — barrel export.
 *
 * Import from '@/components/ui' for any shared primitive.
 *
 * Usage:
 *   import { Card, MetricCard, MetricGrid, SeverityBadge, EmptyState } from '@/components/ui'
 */

export { default as Card }              from './Card'
export { default as Skeleton, SkeletonTable, PageLoader } from './Skeleton'
export { default as EmptyState }        from './EmptyState'
export { default as MetricCard, MetricGrid } from './MetricCard'
export { default as SeverityBadge }     from './SeverityBadge'
export { default as PageHeader }        from './PageHeader'
export { default as SectionHeader }     from './SectionHeader'
export { default as OperationalBanner } from './OperationalBanner'
export { default as TrendIndicator, Sparkline } from './TrendIndicator'
export { default as Button }            from './Button'
export { AlertDialog } from './AlertDialog'
export { ConfirmDialog } from './ConfirmDialog'
export { default as Icon }              from './Icon'
export { default as StatusBadge }       from './StatusBadge'

// Re-export variant helpers
export {
  incidentSeverityLevel,
  priorityLevel,
  complianceLevel,
  shiftStatusLevel,
} from './SeverityBadge'
