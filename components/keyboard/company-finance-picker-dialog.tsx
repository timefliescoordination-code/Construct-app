"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"

interface CompanyFinancePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPickExpense: () => void
  onPickIncome: () => void
}

export function CompanyFinancePickerDialog({
  open,
  onOpenChange,
  onPickExpense,
  onPickIncome,
}: CompanyFinancePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Company tab</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Record a company expense or income entry.
          </p>
        </DialogHeader>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 py-3"
            onClick={onPickExpense}
          >
            <ArrowDownCircle className="h-5 w-5 text-destructive" />
            <span>
              <span className="block font-medium">Company expense</span>
              <span className="block text-xs text-muted-foreground">
                Money spent by the company
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 py-3"
            onClick={onPickIncome}
          >
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
            <span>
              <span className="block font-medium">Company income</span>
              <span className="block text-xs text-muted-foreground">
                Money received by the company
              </span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
