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
import { cn } from "@/lib/utils"
import {
  activeMandatoryFields,
  filterOptionsByPrefix,
  findOptionByLetter,
  optionMatchesPrefix,
  tryOpenDatePicker,
  type MandatoryFieldDef,
} from "@/lib/keyboard/mandatory-expense-fields"

type MandatoryExpenseKeyboardContextValue = {
  submitRef: RefObject<HTMLButtonElement | null>
  submitStepReached: boolean
  fadeSubmitUntilReady: boolean
  bindDate: (fieldId: string) => {
    ref: (el: HTMLInputElement | null) => void
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  }
  bindText: (
    fieldId: string,
    opts?: { multiline?: boolean },
  ) => {
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => void
    onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  }
  bindSelect: (fieldId: string) => {
    open: boolean
    typePrefix: string
    isOptionVisible: (label: string, value: string) => boolean
    onOpenChange: (open: boolean) => void
    onTriggerKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
    triggerRef: (el: HTMLButtonElement | null) => void
  }
}

const MandatoryExpenseKeyboardContext =
  createContext<MandatoryExpenseKeyboardContextValue | null>(null)

export function MandatoryExpenseKeyboardProvider({
  enabled,
  fields,
  onSubmit,
  autoAdvanceSelectOnLetter = false,
  fadeSubmitUntilReady = false,
  children,
}: {
  enabled: boolean
  fields: MandatoryFieldDef[]
  onSubmit: () => void
  /** Typing a letter on a select picks the option and moves to the next field. */
  autoAdvanceSelectOnLetter?: boolean
  /** Keep submit faded until the user completes the last field with Enter. */
  fadeSubmitUntilReady?: boolean
  children: ReactNode
}) {
  const submitRef = useRef<HTMLButtonElement>(null)
  const elementRefs = useRef<Map<string, HTMLElement>>(new Map())
  const didInitialFocusRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [datePickerOpened, setDatePickerOpened] = useState(false)
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [submitStepReached, setSubmitStepReached] = useState(false)
  const [selectTypePrefix, setSelectTypePrefix] = useState("")
  const [pendingAdvanceFrom, setPendingAdvanceFrom] = useState<string | null>(null)
  const letterIndexRef = useRef<Record<string, number>>({})
  const keyboardNavigatingRef = useRef(false)

  const chain = useMemo(() => activeMandatoryFields(fields), [fields])
  const chainKey = useMemo(() => chain.map((f) => f.id).join("|"), [chain])

  const focusField = useCallback(
    (index: number) => {
      const field = chain[index]
      if (!field) return
      setActiveIndex(index)
      if (field.kind === "select") {
        keyboardNavigatingRef.current = true
        setOpenSelectId(field.id)
        setSelectTypePrefix("")
        letterIndexRef.current[field.id] = -1
      } else {
        setOpenSelectId(null)
        setSelectTypePrefix("")
      }
      if (field.kind === "date") {
        setDatePickerOpened(false)
      }
      requestAnimationFrame(() => {
        elementRefs.current.get(field.id)?.focus()
        window.setTimeout(() => {
          keyboardNavigatingRef.current = false
        }, 120)
      })
    },
    [chain],
  )

  const reachSubmitStep = useCallback(() => {
    setSubmitStepReached(true)
    setOpenSelectId(null)
    requestAnimationFrame(() => submitRef.current?.focus())
  }, [])

  const advanceFromFieldId = useCallback(
    (fieldId: string) => {
      const idx = chain.findIndex((f) => f.id === fieldId)
      if (idx < 0) return
      if (chain[idx]?.kind === "date") {
        setDatePickerOpened(false)
      }
      const next = idx + 1
      if (next >= chain.length) {
        setActiveIndex(idx)
        reachSubmitStep()
        return
      }
      focusField(next)
    },
    [chain, focusField, reachSubmitStep],
  )

  const advance = useCallback(() => {
    const field = chain[activeIndex]
    if (field) {
      advanceFromFieldId(field.id)
      return
    }
    const next = activeIndex + 1
    if (next >= chain.length) {
      reachSubmitStep()
      return
    }
    focusField(next)
  }, [activeIndex, chain, advanceFromFieldId, focusField, reachSubmitStep])

  useEffect(() => {
    if (!enabled || chain.length === 0) {
      didInitialFocusRef.current = false
      setSubmitStepReached(false)
      setPendingAdvanceFrom(null)
      return
    }
    if (didInitialFocusRef.current) return
    didInitialFocusRef.current = true
    setActiveIndex(0)
    setDatePickerOpened(false)
    setOpenSelectId(null)
    setSubmitStepReached(false)
    const t = window.setTimeout(() => focusField(0), 80)
    return () => window.clearTimeout(t)
  }, [enabled, chainKey, focusField, chain.length])

  useEffect(() => {
    if (!pendingAdvanceFrom || !enabled) return
    const fromId = pendingAdvanceFrom
    setPendingAdvanceFrom(null)
    advanceFromFieldId(fromId)
  }, [pendingAdvanceFrom, enabled, advanceFromFieldId])

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
        if (datePickerOpened) {
          setDatePickerOpened(false)
          advance()
        } else if (e.currentTarget.value.trim()) {
          advance()
        } else {
          tryOpenDatePicker(e.currentTarget)
          setDatePickerOpened(true)
        }
      },
    }),
    [advance, datePickerOpened, setElementRef],
  )

  const bindText = useCallback(
    (fieldId: string, opts?: { multiline?: boolean }) => ({
      ref: (el: HTMLInputElement | HTMLTextAreaElement | null) =>
        setElementRef(fieldId, el),
      onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key !== "Enter" || e.shiftKey) return
        if (opts?.multiline && !(e.ctrlKey || e.metaKey)) return
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

  const confirmSelectMatch = useCallback(
    (fieldId: string, value: string) => {
      const field = chain.find((f) => f.id === fieldId)
      if (!field) return
      field.setValue?.(value)
      setSelectTypePrefix("")
      setOpenSelectId(null)
      if (autoAdvanceSelectOnLetter) {
        setPendingAdvanceFrom(fieldId)
      }
    },
    [autoAdvanceSelectOnLetter, chain],
  )

  const bindSelect = useCallback(
    (fieldId: string) => {
      const isActive = openSelectId === fieldId
      const typePrefix = isActive ? selectTypePrefix : ""

      return {
        open: isActive,
        typePrefix,
        isOptionVisible: (label: string, value: string) =>
          !isActive || optionMatchesPrefix(label, value, typePrefix),
        onOpenChange: (open: boolean) => {
          if (!open && keyboardNavigatingRef.current) return
          if (open) {
            setOpenSelectId(fieldId)
            setSelectTypePrefix("")
          } else {
            setOpenSelectId(null)
            setSelectTypePrefix("")
          }
        },
        triggerRef: (el: HTMLButtonElement | null) => setElementRef(fieldId, el),
        onTriggerKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
          const field = chain.find((f) => f.id === fieldId)
          if (!field || field.kind !== "select" || !field.options) return

          if (e.key === "Backspace" && autoAdvanceSelectOnLetter) {
            e.preventDefault()
            const nextPrefix = selectTypePrefix.slice(0, -1)
            setSelectTypePrefix(nextPrefix)
            setOpenSelectId(fieldId)
            return
          }

          if (e.key === "Escape" && autoAdvanceSelectOnLetter && selectTypePrefix) {
            e.preventDefault()
            setSelectTypePrefix("")
            setOpenSelectId(fieldId)
            return
          }

          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            if (autoAdvanceSelectOnLetter && selectTypePrefix) {
              const matches = filterOptionsByPrefix(field.options, selectTypePrefix)
              if (matches.length === 1) {
                confirmSelectMatch(fieldId, matches[0].value)
              }
              return
            }
            const value = field.getValue?.() ?? ""
            const isOptional = !field.validate
            if (value || isOptional) {
              setSelectTypePrefix("")
              setOpenSelectId(null)
              advance()
            } else {
              setOpenSelectId(fieldId)
            }
            return
          }

          if (autoAdvanceSelectOnLetter && e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
            e.preventDefault()
            const nextPrefix = `${selectTypePrefix}${e.key.toLowerCase()}`
            const matches = filterOptionsByPrefix(field.options, nextPrefix)
            setSelectTypePrefix(nextPrefix)
            setOpenSelectId(fieldId)

            if (matches.length === 1) {
              confirmSelectMatch(fieldId, matches[0].value)
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
      }
    },
    [
      advance,
      autoAdvanceSelectOnLetter,
      chain,
      confirmSelectMatch,
      openSelectId,
      selectTypePrefix,
      setElementRef,
    ],
  )

  const value = useMemo(
    (): MandatoryExpenseKeyboardContextValue => ({
      submitRef,
      submitStepReached,
      fadeSubmitUntilReady,
      bindDate,
      bindText,
      bindSelect,
    }),
    [bindDate, bindText, bindSelect, fadeSubmitUntilReady, submitStepReached],
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

  const faded =
    kb?.fadeSubmitUntilReady && !kb.submitStepReached && !disabled

  return (
    <Button
      type="button"
      ref={setRef}
      className={cn(
        className,
        faded && "pointer-events-none opacity-35 transition-opacity",
        kb?.fadeSubmitUntilReady &&
          kb.submitStepReached &&
          "opacity-100 transition-opacity",
      )}
      disabled={disabled}
      onClick={onClick}
      tabIndex={faded ? -1 : undefined}
      aria-hidden={faded ? true : undefined}
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
