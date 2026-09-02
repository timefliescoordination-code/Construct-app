import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyUndoSet,
  canRedo,
  canUndo,
  commitUndoCoalesce,
  createUndoStack,
  redoOnce,
  undoOnce,
  undoRedoHotkey,
} from './undo-stack.ts'

describe('undo stack', () => {
  it('undoes and redoes discrete edits', () => {
    let stack = createUndoStack({ n: 1 })
    stack = applyUndoSet(stack, { n: 2 })
    stack = applyUndoSet(stack, { n: 3 })
    assert.equal(stack.present.n, 3)
    assert.equal(canUndo(stack), true)
    stack = undoOnce(stack)
    assert.equal(stack.present.n, 2)
    stack = undoOnce(stack)
    assert.equal(stack.present.n, 1)
    assert.equal(canUndo(stack), false)
    stack = redoOnce(stack)
    assert.equal(stack.present.n, 2)
    assert.equal(canRedo(stack), true)
  })

  it('coalesces a burst of typing into one undo step', () => {
    let stack = createUndoStack({ text: '' })
    stack = applyUndoSet(stack, { text: 'C' }, { coalesce: true })
    stack = applyUndoSet(stack, { text: 'Co' }, { coalesce: true })
    stack = applyUndoSet(stack, { text: 'Con' }, { coalesce: true })
    stack = commitUndoCoalesce(stack)
    assert.equal(stack.present.text, 'Con')
    stack = undoOnce(stack)
    assert.equal(stack.present.text, '')
    stack = redoOnce(stack)
    assert.equal(stack.present.text, 'Con')
  })

  it('starts a new history entry after a discrete action', () => {
    let stack = createUndoStack({ items: ['a'] })
    stack = applyUndoSet(stack, { items: ['ab'] }, { coalesce: true })
    stack = applyUndoSet(stack, { items: ['ab', 'c'] }, { coalesce: false })
    stack = undoOnce(stack)
    assert.deepEqual(stack.present.items, ['ab'])
    stack = undoOnce(stack)
    assert.deepEqual(stack.present.items, ['a'])
  })

  it('maps common undo and redo shortcuts', () => {
    assert.equal(
      undoRedoHotkey({ key: 'z', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false }),
      'undo',
    )
    assert.equal(
      undoRedoHotkey({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false }),
      'redo',
    )
    assert.equal(
      undoRedoHotkey({ key: 'y', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false }),
      'redo',
    )
    assert.equal(
      undoRedoHotkey({ key: 'z', metaKey: false, ctrlKey: true, shiftKey: false, altKey: true }),
      null,
    )
  })
})
