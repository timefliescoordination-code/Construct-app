'use client'

import { Button } from '@/components/ui/button'
import {
  QUALITY_ITEM_STATUS_LABELS,
  type QualityItemStatus,
} from '@/lib/quality/constants'
import { cn } from '@/lib/utils'

const OPTIONS: QualityItemStatus[] = ['pass', 'fail', 'na', 'not_checked']

export function ItemStatusControls({
  value,
  allowNa,
  disabled,
  onChange,
}: {
  value: QualityItemStatus
  allowNa: boolean
  disabled?: boolean
  onChange: (status: QualityItemStatus) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {OPTIONS.filter((status) => status !== 'na' || allowNa).map((status) => {
        const active = value === status
        return (
          <Button
            key={status}
            type="button"
            variant={active ? 'default' : 'outline'}
            disabled={disabled}
            onClick={() => onChange(status)}
            className={cn(
              'h-11 min-w-0 px-2 text-xs font-semibold sm:text-sm',
              active && status === 'pass' && 'bg-green-600 hover:bg-green-600/90',
              active && status === 'fail' && 'bg-destructive hover:bg-destructive/90',
              active && status === 'na' && 'bg-muted text-foreground hover:bg-muted',
            )}
          >
            {QUALITY_ITEM_STATUS_LABELS[status]}
          </Button>
        )
      })}
    </div>
  )
}
