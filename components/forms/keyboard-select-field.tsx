"use client"

import type { KeyboardEvent } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { MandatorySelectOption } from "@/lib/keyboard/mandatory-expense-fields"

interface KeyboardSelectFieldProps {
  fieldId: string
  label?: React.ReactNode
  value: string
  onValueChange: (value: string) => void
  options: MandatorySelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onTriggerKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void
}

export function KeyboardSelectField({
  fieldId,
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  open,
  onOpenChange,
  onTriggerKeyDown,
}: KeyboardSelectFieldProps) {
  return (
    <div className="space-y-2" data-keyboard-field={fieldId}>
      {label}
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        open={open}
        onOpenChange={onOpenChange}
      >
        <SelectTrigger
          className={cn("w-full bg-muted border-border", className)}
          onKeyDown={onTriggerKeyDown}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="z-[100]">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
