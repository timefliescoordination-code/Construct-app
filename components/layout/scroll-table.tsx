import * as React from "react"
import { cn } from "@/lib/utils"

/** Horizontal scroll for wide tables; bleeds to screen edge on small viewports */
export const TABLE_SCROLL_CLASS =
  "relative -mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0 touch-pan-x"

export function ScrollTable({
  children,
  className,
  tableClassName,
  minWidth = "min-w-[640px]",
}: {
  children: React.ReactNode
  className?: string
  /** Applied to inner wrapper around table */
  tableClassName?: string
  minWidth?: string
}) {
  return (
    <div className={cn(TABLE_SCROLL_CLASS, className)}>
      <div className={cn("w-full", minWidth, tableClassName)}>{children}</div>
    </div>
  )
}
