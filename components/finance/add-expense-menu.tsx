"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectPickerDialog } from "@/components/finance/project-picker-dialog"
import { AddExpenseShortcutTooltip } from "@/components/keyboard/add-expense-shortcut-tooltip"

export type ProjectOption = { id: string; name: string }

interface AddExpenseMenuProps {
  projects: ProjectOption[]
  variant?: "default" | "outline"
  className?: string
}

export function AddExpenseMenu({
  projects,
  variant = "default",
  className,
}: AddExpenseMenuProps) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
      <DropdownMenu>
        <AddExpenseShortcutTooltip>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant === "outline" ? "outline" : "default"}
              className={className ?? "gap-2"}
            >
              <Plus className="h-4 w-4" />
              Add Expense
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
        </AddExpenseShortcutTooltip>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
            Project expense
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              router.push("/admin/expenses?tab=company&add=1")
            }
          >
            Company expense
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              router.push("/admin/expenses?tab=company&addIncome=1")
            }
          >
            Company income
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              router.push("/admin/expenses?tab=personal&add=1")
            }
          >
            Personal expense
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projects={projects}
      />
    </>
  )
}
