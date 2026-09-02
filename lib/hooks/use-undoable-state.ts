'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyUndoSet,
  canRedo,
  canUndo,
  commitUndoCoalesce,
  createUndoStack,
  redoOnce,
  type UndoStack,
  undoOnce,
} from '@/lib/proposals/undo-stack'

type SetOptions = {
  coalesce?: boolean
}

export function useUndoableState<T>(initialValue: T | (() => T), debounceMs = 400) {
  const [stack, setStack] = useState<UndoStack<T>>(() =>
    createUndoStack(typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue),
  )
  const stackRef = useRef(stack)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  stackRef.current = stack

  const clearTimer = () => {
    if (timerRef.current == null) return
    clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const set = useCallback(
    (next: T | ((previous: T) => T), options?: SetOptions) => {
      setStack((current) => {
        const value = typeof next === 'function' ? (next as (previous: T) => T)(current.present) : next
        const updated = applyUndoSet(current, value, { coalesce: options?.coalesce })
        return updated
      })
      clearTimer()
      if (options?.coalesce) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          setStack((current) => commitUndoCoalesce(current))
        }, debounceMs)
      }
    },
    [debounceMs],
  )

  const undo = useCallback(() => {
    clearTimer()
    setStack((current) => undoOnce(current))
  }, [])

  const redo = useCallback(() => {
    clearTimer()
    setStack((current) => redoOnce(current))
  }, [])

  useEffect(() => () => clearTimer(), [])

  return {
    value: stack.present,
    set,
    undo,
    redo,
    canUndo: canUndo(stack),
    canRedo: canRedo(stack),
  }
}
