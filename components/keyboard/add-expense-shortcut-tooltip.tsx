"use client"

import { useEffect, useState, type ReactElement } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function useModifierKeyLabel() {
  const [label, setLabel] = useState("Ctrl")
  useEffect(() => {
    const platform = navigator.platform || navigator.userAgent
    if (/Mac|iPhone|iPad/i.test(platform)) setLabel("⌘")
  }, [])
  return label
}

export function AddExpenseShortcutTooltip({
  children,
  hint,
  showShortcut = true,
}: {
  children: ReactElement
  hint?: string
  showShortcut?: boolean
}) {
  const mod = useModifierKeyLabel()
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{hint ?? "Add expense"}</span>
        {showShortcut ? (
          <kbd className="rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[10px] leading-none">
            {mod}+E
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}
