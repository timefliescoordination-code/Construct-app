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
}: CategorySelectFieldProps) {
  const [manageOpen, setManageOpen] = useState(false)

  const names = categories.map((c) => c.name)

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
          <SelectTrigger onKeyDown={onTriggerKeyDown}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {names.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
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
