"use client"

import { useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Building2, IndianRupee, User, Wallet } from "lucide-react"

interface ExpenseTypePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPickProject: () => void
  onPickCompanyExpense: () => void
  onPickCompanyIncome: () => void
  onPickPersonalExpense: () => void
}

const OPTIONS = [
  {
    id: "project",
    label: "Project expense",
    hint: "Bill for a construction project",
    icon: Building2,
  },
  {
    id: "company",
    label: "Company expense",
    hint: "Office or business overhead",
    icon: Wallet,
  },
  {
    id: "income",
    label: "Company income",
    hint: "Money received by the company",
    icon: IndianRupee,
  },
  {
    id: "personal",
    label: "Personal expense",
    hint: "Personal / director expense",
    icon: User,
  },
] as const

export function ExpenseTypePickerDialog({
  open,
  onOpenChange,
  onPickProject,
  onPickCompanyExpense,
  onPickCompanyIncome,
  onPickPersonalExpense,
}: ExpenseTypePickerDialogProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      listRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
    }, 50)
    return () => window.clearTimeout(t)
  }, [open])

  const pick = (id: (typeof OPTIONS)[number]["id"]) => {
    switch (id) {
      case "project":
        onPickProject()
        break
      case "company":
        onPickCompanyExpense()
        break
      case "income":
        onPickCompanyIncome()
        break
      case "personal":
        onPickPersonalExpense()
        break
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense or income</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose a type, then use Enter to move through required fields.
          </p>
        </DialogHeader>
        <div ref={listRef} className="space-y-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <Button
                key={opt.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-3 py-3 text-left"
                onClick={() => pick(opt.id)}
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block font-medium">{opt.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {opt.hint}
                  </span>
                </span>
              </Button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Shortcut: <kbd className="rounded border px-1">Ctrl</kbd>+
          <kbd className="rounded border px-1">E</kbd>
        </p>
      </DialogContent>
    </Dialog>
  )
}
