export type UndoStack<T> = {
  past: T[]
  present: T
  future: T[]
  coalescing: boolean
}

const DEFAULT_CAPACITY = 50

function cloneValue<T>(value: T): T {
  return structuredClone(value)
}

export function createUndoStack<T>(present: T): UndoStack<T> {
  return { past: [], present: cloneValue(present), future: [], coalescing: false }
}

export function applyUndoSet<T>(
  stack: UndoStack<T>,
  next: T,
  options?: { coalesce?: boolean; capacity?: number },
): UndoStack<T> {
  const capacity = options?.capacity ?? DEFAULT_CAPACITY
  const coalesce = Boolean(options?.coalesce)
  const present = cloneValue(next)

  if (coalesce && stack.coalescing) {
    return { ...stack, present }
  }

  const past = [...stack.past, cloneValue(stack.present)].slice(-capacity)
  return {
    past,
    present,
    future: [],
    coalescing: coalesce,
  }
}

export function commitUndoCoalesce<T>(stack: UndoStack<T>): UndoStack<T> {
  if (!stack.coalescing) return stack
  return { ...stack, coalescing: false }
}

export function undoOnce<T>(stack: UndoStack<T>): UndoStack<T> {
  if (stack.past.length === 0) {
    return { ...stack, coalescing: false }
  }
  const past = stack.past.slice(0, -1)
  const previous = stack.past[stack.past.length - 1]
  if (previous === undefined) return { ...stack, coalescing: false }
  return {
    past,
    present: cloneValue(previous),
    future: [...stack.future, cloneValue(stack.present)],
    coalescing: false,
  }
}

export function redoOnce<T>(stack: UndoStack<T>): UndoStack<T> {
  if (stack.future.length === 0) {
    return { ...stack, coalescing: false }
  }
  const next = stack.future[stack.future.length - 1]
  if (next === undefined) return { ...stack, coalescing: false }
  const future = stack.future.slice(0, -1)
  return {
    past: [...stack.past, cloneValue(stack.present)],
    present: cloneValue(next),
    future,
    coalescing: false,
  }
}

export function canUndo<T>(stack: UndoStack<T>): boolean {
  return stack.past.length > 0
}

export function canRedo<T>(stack: UndoStack<T>): boolean {
  return stack.future.length > 0
}

export function undoRedoHotkey(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): 'undo' | 'redo' | null {
  if (event.altKey) return null
  if (!event.metaKey && !event.ctrlKey) return null
  const key = event.key.toLowerCase()
  if (key === 'y') return 'redo'
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  return null
}
