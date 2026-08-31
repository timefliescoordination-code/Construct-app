import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_VERSION_STATUS_LABELS,
  type ProposalStatus,
  type ProposalVersionStatus,
} from '@/lib/proposals/constants'

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  shared: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300',
  viewed: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  revision_requested: 'bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-300',
  revision_created: 'bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-300',
  superseded: 'bg-muted text-muted-foreground border-border',
  accepted: 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-300',
  withdrawn: 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300',
  expired: 'bg-orange-500/15 text-orange-800 border-orange-500/30 dark:text-orange-300',
  archived: 'bg-muted text-muted-foreground border-border',
}

export function ProposalStatusBadge({
  status,
  className,
}: {
  status: ProposalStatus | ProposalVersionStatus | string
  className?: string
}) {
  const label =
    status in PROPOSAL_STATUS_LABELS
      ? PROPOSAL_STATUS_LABELS[status as ProposalStatus]
      : status in PROPOSAL_VERSION_STATUS_LABELS
        ? PROPOSAL_VERSION_STATUS_LABELS[status as ProposalVersionStatus]
        : status

  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status] ?? '', className)}>
      {label}
    </Badge>
  )
}
