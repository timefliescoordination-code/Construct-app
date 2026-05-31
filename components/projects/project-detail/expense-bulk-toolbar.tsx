"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Pencil, Trash2, CheckCircle2, X } from "lucide-react"
import { toast } from "sonner"
import {
  bulkDeleteExpensesAction,
  bulkUpdateExpensesAction,
  type BulkExpensePatch,
} from "@/lib/projects/tab-actions"
import type { ExpenseStatus } from "@/lib/types/database"

const NO_CHANGE = "__no_change__"
const CLEAR_MILESTONE = "__clear_milestone__"
const statuses: ExpenseStatus[] = ["pending", "approved", "rejected"]

type ExpenseRow = {
  id: string
  split_group_id?: string | null
}

interface ExpenseBulkToolbarProps {
  projectId: string
  rows: ExpenseRow[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  canEnterData: boolean
  canManageProjects: boolean
  milestones: { id: string; name: string }[]
  categoryNames: string[]
  disabled?: boolean
  onCompleted: () => void | Promise<void>
}

export function ExpenseBulkToolbar({
  projectId,
  rows,
  selectedIds,
  onSelectionChange,
  canEnterData,
  canManageProjects,
  milestones,
  categoryNames,
  disabled,
  onCompleted,
}: ExpenseBulkToolbarProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [applyMilestone, setApplyMilestone] = useState(false)
  const [applyCategory, setApplyCategory] = useState(false)
  const [applyStatus, setApplyStatus] = useState(false)
  const [bulkMilestone, setBulkMilestone] = useState(NO_CHANGE)
  const [bulkCategory, setBulkCategory] = useState(NO_CHANGE)
  const [bulkStatus, setBulkStatus] = useState<ExpenseStatus | typeof NO_CHANGE>(NO_CHANGE)

  const selectedCount = selectedIds.size

  const selectedSplitCount = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id) && r.split_group_id).length,
    [rows, selectedIds],
  )

  const clearSelection = () => onSelectionChange(new Set())

  const runBulkUpdate = async (patch: BulkExpensePatch) => {
    setIsSubmitting(true)
    const result = await bulkUpdateExpensesAction({
      projectId,
      expenseIds: [...selectedIds],
      patch,
    })
    setIsSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    toast.success(`Updated ${result.data.updated} expense${result.data.updated === 1 ? "" : "s"}.`)
    return true
  }

  const handleBulkApprove = async () => {
    const ok = await runBulkUpdate({ status: "approved" })
    if (ok) {
      clearSelection()
      await onCompleted()
    }
  }

  const handleBulkEditSave = async () => {
    if (!applyMilestone && !applyCategory && !applyStatus) {
      toast.error("Enable at least one field to update.")
      return
    }

    const patch: BulkExpensePatch = {}

    if (applyMilestone) {
      if (bulkMilestone === NO_CHANGE) {
        toast.error("Choose a milestone or clear milestone.")
        return
      }
      patch.milestoneId =
        bulkMilestone === CLEAR_MILESTONE ? null : bulkMilestone
    }
    if (applyCategory) {
      if (bulkCategory === NO_CHANGE) {
        toast.error("Choose a category.")
        return
      }
      patch.category = bulkCategory
    }
    if (applyStatus) {
      if (bulkStatus === NO_CHANGE) {
        toast.error("Choose a status.")
        return
      }
      patch.status = bulkStatus
    }

    const ok = await runBulkUpdate(patch)
    if (ok) {
      setBulkEditOpen(false)
      setApplyMilestone(false)
      setApplyCategory(false)
      setApplyStatus(false)
      setBulkMilestone(NO_CHANGE)
      setBulkCategory(NO_CHANGE)
      setBulkStatus(NO_CHANGE)
      clearSelection()
      await onCompleted()
    }
  }

  const handleBulkDelete = async () => {
    setIsSubmitting(true)
    const result = await bulkDeleteExpensesAction({
      projectId,
      expenseIds: [...selectedIds],
    })
    setIsSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Deleted ${result.data.deleted} expense${result.data.deleted === 1 ? "" : "s"}.`)
    setBulkDeleteOpen(false)
    clearSelection()
    await onCompleted()
  }

  if (!canEnterData) return null

  return (
    <>
      {selectedCount > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-foreground">
              {selectedCount} selected
            </span>
            {selectedSplitCount > 0 && (
              <span className="text-muted-foreground">
                ({selectedSplitCount} split payment
                {selectedSplitCount === 1 ? "" : "s"})
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={clearSelection}
              disabled={isSubmitting || disabled}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isSubmitting || disabled}
              onClick={() => setBulkEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Bulk edit
            </Button>
            {canManageProjects && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isSubmitting || disabled}
                  onClick={() => void handleBulkApprove()}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={isSubmitting || disabled}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Bulk edit expenses</DialogTitle>
            <DialogDescription>
              Apply changes to {selectedCount} selected expense
              {selectedCount === 1 ? "" : "s"}. Enable only the fields you want
              to update.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="bulk-apply-milestone"
                checked={applyMilestone}
                onCheckedChange={(v) => setApplyMilestone(v === true)}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="bulk-apply-milestone">Stage / milestone</Label>
                <Select
                  value={bulkMilestone}
                  onValueChange={setBulkMilestone}
                  disabled={!applyMilestone}
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="No change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE}>No change</SelectItem>
                    <SelectItem value={CLEAR_MILESTONE}>Clear milestone</SelectItem>
                    {milestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="bulk-apply-category"
                checked={applyCategory}
                onCheckedChange={(v) => setApplyCategory(v === true)}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="bulk-apply-category">Category</Label>
                <Select
                  value={bulkCategory}
                  onValueChange={setBulkCategory}
                  disabled={!applyCategory}
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="No change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE}>No change</SelectItem>
                    {categoryNames.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canManageProjects && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="bulk-apply-status"
                  checked={applyStatus}
                  onCheckedChange={(v) => setApplyStatus(v === true)}
                />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="bulk-apply-status">Approval status</Label>
                  <Select
                    value={bulkStatus}
                    onValueChange={(v) =>
                      setBulkStatus(v as ExpenseStatus | typeof NO_CHANGE)
                    }
                    disabled={!applyStatus}
                  >
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue placeholder="No change" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CHANGE}>No change</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setBulkEditOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleBulkEditSave()} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Apply to selected"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} expenses?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Linked invoices will be removed.
              {selectedSplitCount > 0 &&
                " Some selected rows are split payments; deleting them may leave incomplete split groups."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void handleBulkDelete()
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function ExpenseRowCheckbox({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  "aria-label"?: string
}) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel ?? "Select expense"}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

export function ExpenseSelectAllCheckbox({
  allSelected,
  someSelected,
  onToggleAll,
  disabled,
}: {
  allSelected: boolean
  someSelected: boolean
  onToggleAll: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <Checkbox
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      onCheckedChange={(v) => onToggleAll(v === true)}
      disabled={disabled}
      aria-label="Select all expenses"
    />
  )
}
