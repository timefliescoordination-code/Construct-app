import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react"

export type MandatorySelectOption = { value: string; label: string }

export type MandatoryFieldKind = "date" | "select" | "text" | "number"

export type MandatoryFieldDef = {
  id: string
  kind: MandatoryFieldKind
  /** Skip field when true (e.g. labour team only for labour category). */
  skip?: boolean
  options?: MandatorySelectOption[]
  getValue?: () => string
  setValue?: (value: string) => void
  /** For text/number — return error message or null if valid. */
  validate?: () => string | null
}

export function activeMandatoryFields(fields: MandatoryFieldDef[]): MandatoryFieldDef[] {
  return fields.filter((f) => !f.skip)
}

export function findOptionByLetter(
  options: MandatorySelectOption[],
  letter: string,
  startIndex = 0,
): { option: MandatorySelectOption; nextIndex: number } | null {
  if (!letter || options.length === 0) return null
  const ch = letter.toLowerCase()
  for (let i = 0; i < options.length; i += 1) {
    const idx = (startIndex + 1 + i) % options.length
    const opt = options[idx]
    if (opt.label.toLowerCase().startsWith(ch) || opt.value.toLowerCase().startsWith(ch)) {
      return { option: opt, nextIndex: idx }
    }
  }
  return null
}

export function tryOpenDatePicker(input: HTMLInputElement | null) {
  if (!input) return
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker()
    } catch {
      input.focus()
    }
  } else {
    input.focus()
  }
}

export function handleSubmitEnter(
  e: ReactKeyboardEvent,
  onSubmit: () => void,
) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
}

export function mergeRef<T>(
  ...refs: Array<RefObject<T | null> | ((instance: T | null) => void) | null>
) {
  return (instance: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === "function") ref(instance)
      else ref.current = instance
    }
  }
}
