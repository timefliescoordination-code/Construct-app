"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react"
import { Button } from "@/components/ui/button"
import {
  activeMandatoryFields,
  findOptionByLetter,
  tryOpenDatePicker,
  type MandatoryFieldDef,
} from "@/lib/keyboard/mandatory-expense-fields"

type MandatoryExpenseKeyboardContextValue = {
  submitRef: RefObject<HTMLButtonElement | null>
  bindDate: (fieldId: string) => {
    ref: (el: HTMLInputElement | null) => void
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  }
  bindText: (fieldId: string) => {
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => void
    onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  }
  bindSelect: (fieldId: string) => {
    open: boolean
    onOpenChange: (open: boolean) => void
    onTriggerKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
  }
}

const MandatoryExpenseKeyboardContext =
  createContext<MandatoryExpenseKeyboardContextValue | null>(null)

export function MandatoryExpenseKeyboardProvider({
  enabled,
  fields,
  onSubmit,
  children,
}: {
  enabled: boolean
  fields: MandatoryFieldDef[]
  onSubmit: () => void
  children: ReactNode
}) {
  const submitRef = useRef<HTMLButtonElement>(null)
  const elementRefs = useRef<Map<string, HTMLElement>>(new Map())
  const didInitialFocusRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [datePickerOpened, setDatePickerOpened] = useState(false)
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const letterIndexRef = useRef<Record<string, number>>({})

  const chain = useMemo(() => activeMandatoryFields(fields), [fields])
  const chainKey = useMemo(() => chain.map((f) => f.id).join("|"), [chain])

  const focusField = useCallback(
    (index: number) => {
      const field = chain[index]
      if (!field) return
      setActiveIndex(index)
      if (field.kind === "select") {
        setOpenSelectId(field.id)
        letterIndexRef.current[field.id] = -1
      } else {
        setOpenSelectId(null)
      }
      if (field.kind === "date") {
        setDatePickerOpened(false)
      }
      requestAnimationFrame(() => {
        elementRefs.current.get(field.id)?.focus()
      })
    },
    [chain],
  )

  const advance = useCallback(() => {
    const next = activeIndex + 1
    if (next >= chain.length) {
      setOpenSelectId(null)
      submitRef.current?.focus()
      return
    }
    focusField(next)
  }, [activeIndex, chain.length, focusField])

  useEffect(() => {
    if (!enabled || chain.length === 0) {
      didInitialFocusRef.current = false
      return
    }
    if (didInitialFocusRef.current) return
    didInitialFocusRef.current = true
    setActiveIndex(0)
    setDatePickerOpened(false)
    setOpenSelectId(null)
    const t = window.setTimeout(() => focusField(0), 80)
    return () => window.clearTimeout(t)
  }, [enabled, chainKey, focusField, chain.length])

  const setElementRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) elementRefs.current.set(id, el)
    else elementRefs.current.delete(id)
  }, [])

  const bindDate = useCallback(
    (fieldId: string) => ({
      ref: (el: HTMLInputElement | null) => setElementRef(fieldId, el),
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter" || e.shiftKey) return
        e.preventDefault()
        if (!datePickerOpened) {
          tryOpenDatePicker(e.currentTarget)
          setDatePickerOpened(true)
        } else {
          setDatePickerOpened(false)
          advance()
        }
      },
    }),
    [advance, datePickerOpened, setElementRef],
  )

  const bindText = useCallback(
    (fieldId: string) => ({
      ref: (el: HTMLInputElement | HTMLTextAreaElement | null) =>
        setElementRef(fieldId, el),
      onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key !== "Enter" || e.shiftKey) return
        const field = chain.find((f) => f.id === fieldId)
        if (!field) return
        const err = field.validate?.()
        if (err) return
        e.preventDefault()
        advance()
      },
    }),
    [advance, chain, setElementRef],
  )

  const bindSelect = useCallback(
    (fieldId: string) => ({
      open: openSelectId === fieldId,
      onOpenChange: (open: boolean) => {
        setOpenSelectId(open ? fieldId : null)
      },
      onTriggerKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        const field = chain.find((f) => f.id === fieldId)
        if (!field || field.kind !== "select" || !field.options) return

        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          const value = field.getValue?.() ?? ""
          if (value) {
            setOpenSelectId(null)
            advance()
          } else {
            setOpenSelectId(fieldId)
          }
          return
        }

        if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
          e.preventDefault()
          const start = letterIndexRef.current[fieldId] ?? -1
          const match = findOptionByLetter(field.options, e.key, start)
          if (match) {
            letterIndexRef.current[fieldId] = match.nextIndex
            field.setValue?.(match.option.value)
            setOpenSelectId(fieldId)
          }
        }
      },
    }),
    [advance, chain, openSelectId],
  )

  const value = useMemo(
    (): MandatoryExpenseKeyboardContextValue => ({
      submitRef,
      bindDate,
      bindText,
      bindSelect,
    }),
    [bindDate, bindText, bindSelect],
  )

  return (
    <MandatoryExpenseKeyboardContext.Provider value={value}>
      {children}
    </MandatoryExpenseKeyboardContext.Provider>
  )
}

export function useMandatoryExpenseKeyboard() {
  return useContext(MandatoryExpenseKeyboardContext)
}

export function MandatoryExpenseSubmitButton({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
}) {
  const kb = useMandatoryExpenseKeyboard()
  const localRef = useRef<HTMLButtonElement>(null)

  const setRef = (el: HTMLButtonElement | null) => {
    localRef.current = el
    if (kb?.submitRef) {
      ;(kb.submitRef as MutableRefObject<HTMLButtonElement | null>).current = el
    }
  }

  return (
    <Button
      type="button"
      ref={setRef}
      className={className}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {children}
    </Button>
  )
}
