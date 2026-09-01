import { Badge } from '@/components/ui/badge'
import {
  QUALITY_INSPECTION_STATUS_LABELS,
  QUALITY_ITEM_STATUS_LABELS,
  type QualityInspectionStatus,
  type QualityItemStatus,
} from '@/lib/quality/constants'
import { cn } from '@/lib/utils'

const INSPECTION_STYLES: Record<QualityInspectionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  submitted: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  failed: 'bg-destructive/15 text-destructive',
  awaiting_correction: 'bg-orange-500/15 text-orange-800 dark:text-orange-300',
  ready_for_reinspection: 'bg-purple-500/15 text-purple-800 dark:text-purple-300',
  approved: 'bg-green-500/15 text-green-800 dark:text-green-300',
  rejected: 'bg-destructive/15 text-destructive',
  closed: 'bg-muted text-muted-foreground',
}

const ITEM_STYLES: Record<QualityItemStatus, string> = {
  pass: 'bg-green-500/15 text-green-800 dark:text-green-300 border-green-500/30',
  fail: 'bg-destructive/15 text-destructive border-destructive/30',
  na: 'bg-muted text-muted-foreground',
  not_checked: 'bg-background text-muted-foreground',
}

export function InspectionStatusBadge({
  status,
  className,
}: {
  status: QualityInspectionStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(INSPECTION_STYLES[status], className)}>
      {QUALITY_INSPECTION_STATUS_LABELS[status]}
    </Badge>
  )
}

export function ItemStatusBadge({
  status,
  className,
}: {
  status: QualityItemStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(ITEM_STYLES[status], className)}>
      {QUALITY_ITEM_STATUS_LABELS[status]}
    </Badge>
  )
}
