"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ProjectIdleStatus } from "@/lib/project-idle"

const BAND_STYLES = {
  active:
    "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
  slow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  idle: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  critical:
    "border-destructive/30 bg-destructive/10 text-destructive",
} as const

type ProjectIdleBadgeProps = {
  idle: ProjectIdleStatus
  className?: string
  showTooltip?: boolean
}

export function ProjectIdleBadge({
  idle,
  className,
  showTooltip = true,
}: ProjectIdleBadgeProps) {
  if (idle.label === "—") {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>—</span>
    )
  }

  const badge = (
    <Badge
      variant="outline"
      className={cn("font-normal", BAND_STYLES[idle.band], className)}
    >
      {idle.label}
    </Badge>
  )

  if (!showTooltip || !idle.detail) {
    return badge
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {idle.detail}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
