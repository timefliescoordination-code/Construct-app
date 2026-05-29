"use client"

import Link from "next/link"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Flag } from "lucide-react"
import { TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  buildMilestoneTabHref,
  milestoneSectionFromHasLoss,
  tooltipForMilestoneSection,
} from "@/lib/milestone-navigation"

interface ProjectMilestoneLinkProps {
  projectId: string
  hasStageLoss?: boolean
  className?: string
}

export function ProjectMilestoneLink({
  projectId,
  hasStageLoss = false,
  className,
}: ProjectMilestoneLinkProps) {
  const section = milestoneSectionFromHasLoss(hasStageLoss)
  const href = buildMilestoneTabHref(projectId, section)
  const tooltip = tooltipForMilestoneSection(section)

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <Link
          href={href}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            "border shadow-sm transition-colors",
            hasStageLoss
              ? "border-destructive/35 bg-destructive/10 text-destructive hover:border-destructive/55 hover:bg-destructive/20"
              : "border-primary/25 bg-primary/10 text-primary hover:border-primary/50 hover:bg-primary/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            className,
          )}
          aria-label={tooltip}
        >
          <Flag className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </Link>
      </TooltipPrimitive.Trigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[240px] text-center">
        {tooltip}
      </TooltipContent>
    </TooltipPrimitive.Root>
  )
}
