"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, HardHat, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { DashboardHeader } from "@/components/dashboard/header"
import { PageHeader, PageMain, PageShell } from "@/components/layout/page"
import { useAuth } from "@/lib/hooks/use-auth"
import { formatINR } from "@/lib/currency"
import type { LabourType } from "@/lib/types/database"
import {
  createCompanyLabourTypeAction,
  deleteCompanyLabourTypeAction,
  getCompanyLabourTypesAction,
  updateCompanyLabourTypeAction,
} from "@/lib/labour-types/actions"

export function LabourSettingsContent() {
  const router = useRouter()
  const { isAdmin, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [types, setTypes] = useState<LabourType[]>([])
  const [newName, setNewName] = useState("")
  const [newShortLabel, setNewShortLabel] = useState("")
  const [newWage, setNewWage] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingShortLabel, setEditingShortLabel] = useState("")
  const [editingWage, setEditingWage] = useState("")

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/login")
    }
  }, [authLoading, isAdmin, router])

  const loadTypes = useCallback(async () => {
    const result = await getCompanyLabourTypesAction()
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setTypes(result.data)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    void loadTypes().finally(() => setLoading(false))
  }, [isAdmin, loadTypes])

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("Labour type name is required.")
      return
    }
    const defaultWage = Number(newWage)
    if (!Number.isFinite(defaultWage) || defaultWage < 0) {
      toast.error("Enter a valid default wage.")
      return
    }
    setSaving(true)
    const result = await createCompanyLabourTypeAction({
      name: newName,
      shortLabel: newShortLabel,
      defaultWage,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Labour type added on every project.")
    setNewName("")
    setNewShortLabel("")
    setNewWage("")
    await loadTypes()
  }

  const handleSave = async () => {
    if (!editingId) return
    const defaultWage = Number(editingWage)
    if (!Number.isFinite(defaultWage) || defaultWage < 0) {
      toast.error("Enter a valid default wage.")
      return
    }
    setSaving(true)
    const result = await updateCompanyLabourTypeAction({
      labourTypeId: editingId,
      name: editingName,
      shortLabel: editingShortLabel,
      defaultWage,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Updated on every project.")
    setEditingId(null)
    await loadTypes()
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    const result = await deleteCompanyLabourTypeAction({ labourTypeId: id })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Removed from every project.")
    await loadTypes()
  }

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Manage labours"
          description="Company-wide labour types. Adding, editing, or deleting here updates manpower on every project."
        >
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin" aria-label="Back to admin dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </PageHeader>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="section-card max-w-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardHat className="h-5 w-5" />
                Labour types
              </CardTitle>
              <CardDescription>
                {types.length} types. Default daily wage is used for new manpower weeks;
                existing week rates stay as entered on each site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border p-2">
                {types.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No labour types yet.
                  </p>
                ) : (
                  types.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-md bg-muted/40 px-2 py-2 sm:flex-row sm:items-center"
                    >
                      <span className="hidden w-6 shrink-0 text-center text-xs text-muted-foreground sm:block">
                        {index + 1}
                      </span>
                      {editingId === item.id ? (
                        <>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8 flex-1"
                            aria-label="Labour type name"
                          />
                          <Input
                            value={editingShortLabel}
                            onChange={(e) => setEditingShortLabel(e.target.value)}
                            className="h-8 sm:w-24"
                            aria-label="Short label"
                          />
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={editingWage}
                            onChange={(e) => setEditingWage(e.target.value)}
                            className="h-8 sm:w-28"
                            aria-label="Default daily wage"
                          />
                        </>
                      ) : (
                        <>
                          <p className="min-w-0 flex-1 truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {item.short_label || "—"}
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {formatINR(Number(item.default_wage))}/day
                          </span>
                        </>
                      )}
                      <div className="flex shrink-0 gap-1">
                        {editingId === item.id ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={saving}
                            onClick={() => void handleSave()}
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
                                setEditingShortLabel(item.short_label || "")
                                setEditingWage(String(Number(item.default_wage)))
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
                                    This removes the labour type from every project. Types
                                    that already have manpower entries cannot be deleted.
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
              <div className="space-y-2 rounded-lg border p-3">
                <Label>Add labour type</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Mason"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAdd()
                    }}
                  />
                  <Input
                    value={newShortLabel}
                    onChange={(e) => setNewShortLabel(e.target.value)}
                    placeholder="Short"
                    className="sm:w-24"
                    aria-label="Short label"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={newWage}
                    onChange={(e) => setNewWage(e.target.value)}
                    placeholder="Wage / day"
                    className="sm:w-32"
                    aria-label="Default daily wage"
                  />
                  <Button onClick={() => void handleAdd()} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="mr-1 h-4 w-4" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </PageMain>
    </PageShell>
  )
}
