"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { FinanceCategory, FinanceCategoryKind } from "@/lib/types/database"
import {
  createFinanceCategoryAction,
  deleteFinanceCategoryAction,
  updateFinanceCategoryAction,
} from "@/lib/finance/finance-category-actions"

const KIND_LABELS: Record<FinanceCategoryKind, string> = {
  company_expense: "company expense",
  company_income: "company income",
  personal_expense: "personal expense",
}

interface FinanceCategoryManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: FinanceCategoryKind
  categories: FinanceCategory[]
  onSaved: () => void
}

export function FinanceCategoryManageDialog({
  open,
  onOpenChange,
  kind,
  categories,
  onSaved,
}: FinanceCategoryManageDialogProps) {
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  useEffect(() => {
    if (!open) {
      setNewName("")
      setEditingId(null)
      setEditingName("")
    }
  }, [open])

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("Name is required.")
      return
    }
    setSaving(true)
    const result = await createFinanceCategoryAction({ kind, name: newName })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category added.")
    setNewName("")
    onSaved()
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    if (editingId.startsWith("fallback-")) {
      toast.error("Run the finance_categories migration to edit categories.")
      return
    }
    setSaving(true)
    const result = await updateFinanceCategoryAction({
      id: editingId,
      kind,
      name: editingName,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category updated.")
    setEditingId(null)
    setEditingName("")
    onSaved()
  }

  const handleDelete = async (id: string) => {
    if (id.startsWith("fallback-")) {
      toast.error("Run the finance_categories migration to manage categories.")
      return
    }
    setSaving(true)
    const result = await deleteFinanceCategoryAction({ id, kind })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category deleted.")
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage {KIND_LABELS[kind]} categories</DialogTitle>
        </DialogHeader>

        <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-2">
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No categories yet.
            </p>
          ) : (
            categories.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-2"
              >
                {editingId === item.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-8 flex-1"
                  />
                ) : (
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item.name}
                  </p>
                )}
                <div className="flex shrink-0 gap-1">
                  {editingId === item.id ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleSaveEdit()}
                      disabled={saving}
                    >
                      Save
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingId(item.id)
                          setEditingName(item.name)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Categories used on existing entries cannot be deleted.
                              Renaming updates all entries using that category.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void handleDelete(item.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <Label>Add new category</Label>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd()
              }}
            />
            <Button onClick={() => void handleAdd()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
