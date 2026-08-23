import { Badge } from '@/components/ui/badge'
import { CHANGE_REQUEST_STATUS_LABELS } from '@/lib/change-requests/constants'
import type { ChangeRequestStatus } from '@/lib/types/database'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Partial<Record<ChangeRequestStatus, string>> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  under_review: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  costing_prepared: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  internal_approval_pending: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  customer_approval_pending: 'bg-primary/15 text-primary',
  approved: 'bg-green-500/15 text-green-700 dark:text-green-300',
  scheduled: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  in_progress: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  completed: 'bg-green-600/15 text-green-800 dark:text-green-200',
  rejected: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
}

export function ChangeRequestStatusBadge({
  status,
  className,
}: {
  status: ChangeRequestStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {CHANGE_REQUEST_STATUS_LABELS[status]}
    </Badge>
  )
}
