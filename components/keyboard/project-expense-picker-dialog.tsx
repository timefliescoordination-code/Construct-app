"use client"

import { useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Building2, Receipt } from "lucide-react"

interface ProjectExpensePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPickExpense: () => void
  onPickReceipt: () => void
  showReceipts?: boolean
}

export function ProjectExpensePickerDialog({
  open,
  onOpenChange,
  onPickExpense,
  onPickReceipt,
  showReceipts = true,
}: ProjectExpensePickerDialogProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      listRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
    }, 50)
    return () => window.clearTimeout(t)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Project expense</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Record a project bill or a client payment receipt.
          </p>
        </DialogHeader>
        <div ref={listRef} className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 py-3 text-left"
            onClick={onPickExpense}
          >
            <Building2 className="h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block font-medium">Project expense</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Bill for a construction project
              </span>
            </span>
          </Button>
          {showReceipts ? (
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-3 py-3 text-left"
              onClick={onPickReceipt}
            >
              <Receipt className="h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Project payments (Receipts)</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Record money received from the client
                </span>
              </span>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
