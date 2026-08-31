"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  const [pickerMode, setPickerMode] = useState<"expense" | "receipt">("expense")

  return (
    <>
      <DropdownMenu modal={false}>
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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Project expense</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuItem
                onSelect={() => {
                  setPickerMode("expense")
                  window.setTimeout(() => setPickerOpen(true), 0)
                }}
              >
                Project expense
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setPickerMode("receipt")
                  window.setTimeout(() => setPickerOpen(true), 0)
                }}
              >
                Project payments (Receipts)
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
        title={
          pickerMode === "receipt"
            ? "Select project for receipts"
            : "Select project"
        }
        hrefForProject={
          pickerMode === "receipt"
            ? (id) => `/projects/${id}?tab=payments&addReceipt=1`
            : undefined
        }
      />
    </>
  )
}
