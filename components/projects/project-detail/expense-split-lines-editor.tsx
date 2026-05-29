"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus } from "lucide-react"
import {
  MAX_EXPENSE_SPLITS,
  sumSplitAmounts,
  type SplitLineInput,
} from "@/lib/expense-splits/calculations"
import { format } from "date-fns"

interface ExpenseSplitLinesEditorProps {
  totalAmount: string
  lines: SplitLineInput[]
  onChange: (lines: SplitLineInput[]) => void
  disabled?: boolean
}

export function ExpenseSplitLinesEditor({
  totalAmount,
  lines,
  onChange,
  disabled = false,
}: ExpenseSplitLinesEditorProps) {
  const total = parseFloat(totalAmount) || 0
  const allocated = sumSplitAmounts(lines)
  const remaining = total - allocated
  const overAllocated = total > 0 && allocated > total + 0.01

  const addLine = () => {
    if (lines.length >= MAX_EXPENSE_SPLITS) return
    onChange([
      ...lines,
      {
        amount: remaining > 0 ? String(Math.round(remaining * 100) / 100) : "",
        date: format(new Date(), "yyyy-MM-dd"),
      },
    ])
  }

  const updateLine = (index: number, patch: Partial<SplitLineInput>) => {
    const next = [...lines]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Next payment</Label>
        <p className="text-xs text-muted-foreground">
          {lines.length}/{MAX_EXPENSE_SPLITS} · ₹{allocated.toLocaleString()} this entry
          {total > 0 && (
            <span
              className={
                overAllocated ? " text-destructive" : " text-amber-600"
              }
            >
              {" "}
              (₹{Math.max(0, remaining).toLocaleString()} left on obligation)
            </span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div
            key={line.id ?? `new-${index}`}
            className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2"
          >
            <span className="pb-2 text-xs font-semibold text-muted-foreground w-6">
              {index + 1}
            </span>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={line.amount}
                disabled={disabled || line.locked}
                onChange={(e) => updateLine(index, { amount: e.target.value })}
                className="h-9 bg-muted border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Payment date</Label>
              <Input
                type="date"
                value={line.date}
                disabled={disabled || line.locked}
                onChange={(e) => updateLine(index, { date: e.target.value })}
                className="h-9 bg-muted border-border"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={disabled}
              onClick={() => removeLine(index)}
              title={line.locked ? "Delete this split" : "Remove"}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={disabled || lines.length >= MAX_EXPENSE_SPLITS}
        onClick={addLine}
      >
        <Plus className="mr-1 h-4 w-4" />
        Add split
      </Button>
    </div>
  )
}
