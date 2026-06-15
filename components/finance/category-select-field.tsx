"use client"

import { useState, type KeyboardEvent } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FinanceCategory, FinanceCategoryKind } from "@/lib/types/database"
import { FinanceCategoryManageDialog } from "@/components/finance/finance-category-manage-dialog"
import { cn } from "@/lib/utils"

interface CategorySelectFieldProps {
  label?: string
  kind: FinanceCategoryKind
  value: string
  onValueChange: (value: string) => void
  categories: FinanceCategory[]
  onCategoriesChange: () => void
  selectOpen?: boolean
  onSelectOpenChange?: (open: boolean) => void
  onTriggerKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void
  triggerRef?: (el: HTMLButtonElement | null) => void
  typePrefix?: string
  isOptionVisible?: (label: string, value: string) => boolean
}

export function CategorySelectField({
  label = "Category",
  kind,
  value,
  onValueChange,
  categories,
  onCategoriesChange,
  selectOpen,
  onSelectOpenChange,
  onTriggerKeyDown,
  triggerRef,
  typePrefix,
  isOptionVisible,
}: CategorySelectFieldProps) {
  const [manageOpen, setManageOpen] = useState(false)

  const names = categories
    .map((c) => c.name)
    .filter((name) => isOptionVisible?.(name, name) ?? true)

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{label}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setManageOpen(true)}
          >
            <Pencil className="h-3 w-3" />
            Edit categories
          </Button>
        </div>
        <Select
          value={value}
          onValueChange={onValueChange}
          open={selectOpen}
          onOpenChange={onSelectOpenChange}
        >
          <SelectTrigger
            ref={triggerRef}
            className={cn(typePrefix && "ring-1 ring-primary/40")}
            onKeyDown={onTriggerKeyDown}
          >
            {typePrefix ? (
              <span className="truncate text-muted-foreground text-sm">
                type to filter…
              </span>
            ) : (
              <SelectValue placeholder="Select category" />
            )}
          </SelectTrigger>
          <SelectContent>
            {typePrefix ? (
              <div className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
                Filter:{" "}
                <kbd className="rounded border bg-muted px-1 font-mono">{typePrefix}</kbd>
              </div>
            ) : null}
            {names.length === 0 && typePrefix ? (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                No matches — Backspace to edit
              </p>
            ) : (
              names.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <FinanceCategoryManageDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        kind={kind}
        categories={categories}
        onSaved={onCategoriesChange}
      />
    </>
  )
}
