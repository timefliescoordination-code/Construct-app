"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatINR } from "@/lib/currency"
import { ExpenseSplitLinesEditor } from "@/components/projects/project-detail/expense-split-lines-editor"
import {
  getRemainingRecordedBalance,
  getSplitPaymentStatus,
  sumRecordedSplitAmounts,
  type SplitLineInput,
  type SplitPaymentDisplayStatus,
} from "@/lib/expense-splits/calculations"
import {
  getExpenseSplitGroupAction,
  updateExpenseSplitGroupAction,
} from "@/lib/projects/expense-split-actions"
import { updateExpenseStatusAction } from "@/lib/projects/tab-actions"

interface ExpenseSplitGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  groupId: string
  canApprove: boolean
  onSaved: () => void
}

function paymentStatusBadge(status: SplitPaymentDisplayStatus) {
  switch (status) {
    case "Fully paid":
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          Fully paid
        </Badge>
      )
    case "Partially paid":
      return (
        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
          Partially paid
        </Badge>
      )
    default:
      return (
        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
          Pending payment
        </Badge>
      )
  }
}

export function ExpenseSplitGroupDialog({
  open,
  onOpenChange,
  projectId,
  groupId,
  canApprove,
  onSaved,
}: ExpenseSplitGroupDialogProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [totalAmount, setTotalAmount] = useState(0)
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [vendor, setVendor] = useState("")
  const [lockedLines, setLockedLines] = useState<SplitLineInput[]>([])
  const [newLines, setNewLines] = useState<SplitLineInput[]>([])
  const [paymentStatus, setPaymentStatus] =
    useState<SplitPaymentDisplayStatus>("Pending payment")
  const [splitMeta, setSplitMeta] = useState<
    { id: string; status: string; splitNumber: number }[]
  >([])

  useEffect(() => {
    if (!open || !groupId) return

    async function load() {
      setLoading(true)
      const result = await getExpenseSplitGroupAction({ projectId, groupId })
      setLoading(false)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const { group, splits, paymentStatus: ps } = result.data
      setTotalAmount(Number(group.total_amount))
      setCategory(group.category)
      setDescription(group.description)
      setVendor(group.vendor_name ?? "")
      setPaymentStatus(ps)
      setSplitMeta(
        splits.map((s) => ({
          id: s.id,
          status: s.status,
          splitNumber: s.split_number ?? 0,
        })),
      )
      setLockedLines(
        splits.map((s) => ({
          id: s.id,
          amount: String(s.amount),
          date: s.expense_date,
          locked: true,
        })),
      )
      setNewLines([])
    }

    void load()
  }, [open, groupId, projectId])

  const handleSave = async () => {
    const existingIds = lockedLines.map((l) => l.id!).filter(Boolean)
    const deleteIds = splitMeta
      .map((m) => m.id)
      .filter((id) => !existingIds.includes(id))

    setSaving(true)
    const result = await updateExpenseSplitGroupAction({
      projectId,
      groupId,
      existingSplitIds: existingIds,
      newSplits: newLines,
      deleteSplitIds: deleteIds,
    })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Split payments updated.")
    onSaved()
    onOpenChange(false)
  }

  const recordedSplitAmount = sumRecordedSplitAmounts(
    lockedLines.map((l) => ({ amount: Number(l.amount) })),
  )

  const remainingBalance = getRemainingRecordedBalance(
    totalAmount,
    lockedLines.map((l) => ({ amount: Number(l.amount) })),
  )

  const handleAddAnotherSplit = () => {
    setNewLines([
      {
        amount:
          remainingBalance > 0
            ? String(Math.round(remainingBalance * 100) / 100)
            : "",
        date: format(new Date(), "yyyy-MM-dd"),
      },
    ])
  }

  const handleApproveSplit = async (expenseId: string) => {
    setSaving(true)
    const result = await updateExpenseStatusAction({
      projectId,
      expenseId,
      status: "approved",
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Split approved.")
    onSaved()
    const reload = await getExpenseSplitGroupAction({ projectId, groupId })
    if (reload.ok) {
      const { group, splits, paymentStatus: ps } = reload.data
      setPaymentStatus(ps)
      setSplitMeta(
        splits.map((s) => ({
          id: s.id,
          status: s.status,
          splitNumber: s.split_number ?? 0,
        })),
      )
      setLockedLines(
        splits.map((s) => ({
          id: s.id,
          amount: String(s.amount),
          date: s.expense_date,
          locked: true,
        })),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Edit split payment
            {paymentStatusBadge(paymentStatus)}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Total obligation: </span>
                <span className="font-semibold">{formatINR(totalAmount)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Recorded: </span>
                {formatINR(recordedSplitAmount)}
                {" · "}
                <span className="text-muted-foreground">Remaining: </span>
                <span className="font-medium text-amber-600">
                  {formatINR(remainingBalance)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Category: </span>
                {category}
              </p>
              <p className="truncate">
                <span className="text-muted-foreground">Description: </span>
                {description}
              </p>
              {vendor && (
                <p>
                  <span className="text-muted-foreground">Vendor: </span>
                  {vendor}
                </p>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                Add the next payment on its actual date. Previous payments cannot be
                edited—only removed. Pending balance also appears on the Payments tab
                until the total is fully recorded.
              </p>
            </div>

            {lockedLines.map((line, index) => {
              const meta = splitMeta.find((m) => m.id === line.id)
              return (
                <div
                  key={line.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <span>
                    Split {meta?.splitNumber ?? index + 1} ·{" "}
                    {format(new Date(line.date), "MMM d, yyyy")} · ₹
                    {Number(line.amount).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    {meta?.status === "pending" && canApprove && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        disabled={saving}
                        onClick={() => void handleApproveSplit(line.id!)}
                      >
                        Approve
                      </Button>
                    )}
                    {meta?.status === "approved" && (
                      <Badge variant="outline" className="text-green-600 text-[10px]">
                        Approved
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={saving}
                      onClick={() =>
                        setLockedLines((prev) => prev.filter((l) => l.id !== line.id))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}

            <ExpenseSplitLinesEditor
              totalAmount={String(totalAmount)}
              recordedAmount={recordedSplitAmount}
              lines={newLines}
              onChange={setNewLines}
              disabled={saving}
            />

            {newLines.length === 0 && lockedLines.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAnotherSplit}
              >
                Add another split
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Record payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
