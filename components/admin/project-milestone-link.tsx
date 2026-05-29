"use client"

import Link from "next/link"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Flag } from "lucide-react"
import { TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export const PROJECT_MILESTONE_TOOLTIP =
  "Find where money goes — open milestones for this project"

interface ProjectMilestoneLinkProps {
  projectId: string
  className?: string
}

export function ProjectMilestoneLink({ projectId, className }: ProjectMilestoneLinkProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <Link
          href={`/projects/${projectId}?tab=milestones`}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            "border border-primary/25 bg-primary/10 text-primary",
            "shadow-sm transition-colors",
            "hover:border-primary/50 hover:bg-primary/20 hover:text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            className,
          )}
          aria-label={PROJECT_MILESTONE_TOOLTIP}
        >
          <Flag className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </Link>
      </TooltipPrimitive.Trigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-center">
        {PROJECT_MILESTONE_TOOLTIP}
      </TooltipContent>
    </TooltipPrimitive.Root>
  )
}
