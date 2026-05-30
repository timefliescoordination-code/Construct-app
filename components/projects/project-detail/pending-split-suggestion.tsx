"use client"

import { Button } from "@/components/ui/button"
import { Split } from "lucide-react"
import { formatINR } from "@/lib/currency"

interface PendingSplitSuggestionProps {
  label: string
  category: string
  recorded: number
  total: number
  remaining: number
  splitCount: number
  vendor?: string | null
  onContinue: () => void
}

export function PendingSplitSuggestion({
  label,
  category,
  recorded,
  total,
  remaining,
  splitCount,
  vendor,
  onContinue,
}: PendingSplitSuggestionProps) {
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500/35 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15">
              <Split className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </span>
            Pending split payment for {label}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground pl-9">
            <span className="font-medium text-foreground">{category}</span>
            {" · "}
            {splitCount} payment{splitCount === 1 ? "" : "s"} recorded ·{" "}
            {formatINR(recorded)} of {formatINR(total)} paid ·{" "}
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {formatINR(remaining)} left
            </span>
            {vendor ? ` · ${vendor}` : ""}
          </p>
          <p className="text-xs text-muted-foreground pl-9">
            You don&apos;t need to use split mode again — continue this payment
            to record the next part.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 sm:ml-2"
          onClick={onContinue}
        >
          Continue payment
        </Button>
      </div>
    </div>
  )
}
