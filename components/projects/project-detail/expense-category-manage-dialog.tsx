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
import type { ExpenseCategoryView } from "@/lib/data/expense-categories"
import {
  createExpenseCategoryAction,
  createExpenseSubcategoryAction,
  deleteExpenseCategoryAction,
  deleteExpenseSubcategoryAction,
  updateExpenseCategoryAction,
  updateExpenseSubcategoryAction,
} from "@/lib/projects/expense-category-actions"
import {
  createLabourTeamAction,
  deleteLabourTeamAction,
  updateLabourTeamAction,
} from "@/lib/projects/labour-team-actions"

type ManageMode = "categories" | "subcategories" | "labour-teams"

interface LabourTeamRow {
  id: string
  name: string
}

interface ExpenseCategoryManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  mode: ManageMode
  categories: ExpenseCategoryView[]
  selectedCategoryName?: string
  labourTeams: LabourTeamRow[]
  onSaved: () => void
}

export function ExpenseCategoryManageDialog({
  open,
  onOpenChange,
  projectId,
  mode,
  categories,
  selectedCategoryName = "",
  labourTeams,
  onSaved,
}: ExpenseCategoryManageDialogProps) {
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  const selectedCategory = categories.find((c) => c.name === selectedCategoryName)

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
    let result:
      | { ok: true }
      | { ok: false; error: string }

    if (mode === "categories") {
      result = await createExpenseCategoryAction({
        projectId,
        name: newName,
      })
    } else if (mode === "labour-teams") {
      result = await createLabourTeamAction({ projectId, name: newName })
    } else if (selectedCategory) {
      result = await createExpenseSubcategoryAction({
        projectId,
        categoryId: selectedCategory.id,
        name: newName,
      })
    } else {
      result = { ok: false, error: "Select a category first." }
    }

    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Added.")
    setNewName("")
    onSaved()
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    setSaving(true)
    let result:
      | { ok: true }
      | { ok: false; error: string }

    if (mode === "categories") {
      result = await updateExpenseCategoryAction({
        projectId,
        categoryId: editingId,
        name: editingName,
      })
    } else if (mode === "labour-teams") {
      result = await updateLabourTeamAction({
        projectId,
        labourTeamId: editingId,
        name: editingName,
      })
    } else {
      result = await updateExpenseSubcategoryAction({
        projectId,
        subcategoryId: editingId,
        name: editingName,
      })
    }

    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Updated.")
    setEditingId(null)
    setEditingName("")
    onSaved()
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    let result:
      | { ok: true }
      | { ok: false; error: string }

    if (mode === "categories") {
      result = await deleteExpenseCategoryAction({ projectId, categoryId: id })
    } else if (mode === "labour-teams") {
      result = await deleteLabourTeamAction({ projectId, labourTeamId: id })
    } else {
      result = await deleteExpenseSubcategoryAction({
        projectId,
        subcategoryId: id,
      })
    }

    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Deleted.")
    onSaved()
  }

  const title =
    mode === "categories"
      ? "Manage expense categories"
      : mode === "labour-teams"
        ? "Manage labour teams"
        : `Manage subcategories — ${selectedCategoryName}`

  const items: { id: string; name: string; meta?: string }[] =
    mode === "categories"
      ? categories.map((c) => ({
          id: c.id,
          name: c.name,
          meta: c.usesLabourTeams ? "Uses labour teams" : undefined,
        }))
      : mode === "labour-teams"
        ? labourTeams.map((t) => ({ id: t.id, name: t.name }))
        : (selectedCategory?.subcategories ?? []).map((s) => ({
            id: s.id,
            name: s.name,
          }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-2">
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No items yet. Add one below.
            </p>
          ) : (
            items.map((item) => (
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.meta && (
                      <p className="text-xs text-muted-foreground">{item.meta}</p>
                    )}
                  </div>
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
                              {mode === "categories"
                                ? "Categories with existing expenses cannot be deleted."
                                : mode === "labour-teams"
                                  ? "Teams linked to labour expenses cannot be deleted."
                                  : "This removes the subcategory from the list for everyone."}
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
          <Label>Add new</Label>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={
                mode === "categories"
                  ? "e.g. Materials"
                  : mode === "labour-teams"
                    ? "e.g. Civil Team"
                    : "e.g. Cement"
              }
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
