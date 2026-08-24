"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Flag, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
import type { MilestoneTemplateView } from "@/lib/data/milestone-templates"
import {
  createMilestoneTemplateAction,
  deleteMilestoneTemplateAction,
  getMilestoneTemplatesAction,
  updateMilestoneTemplateAction,
} from "@/lib/milestones/actions"

export function MilestoneSettingsContent() {
  const router = useRouter()
  const { isAdmin, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<MilestoneTemplateView[]>([])
  const [newName, setNewName] = useState("")
  const [newPercent, setNewPercent] = useState("0")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingPercent, setEditingPercent] = useState("0")

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/login")
    }
  }, [authLoading, isAdmin, router])

  const loadTemplates = useCallback(async () => {
    const result = await getMilestoneTemplatesAction()
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setTemplates(result.data)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    void loadTemplates().finally(() => setLoading(false))
  }, [isAdmin, loadTemplates])

  const totalPercent = templates.reduce((sum, t) => sum + t.expectedCostPercent, 0)

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error("Stage name is required.")
      return
    }
    setSaving(true)
    const result = await createMilestoneTemplateAction({
      name: newName,
      expectedCostPercent: Number(newPercent),
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Stage added for upcoming projects.")
    setNewName("")
    setNewPercent("0")
    await loadTemplates()
  }

  const handleSave = async () => {
    if (!editingId) return
    setSaving(true)
    const result = await updateMilestoneTemplateAction({
      id: editingId,
      name: editingName,
      expectedCostPercent: Number(editingPercent),
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Updated. Existing project stages are unchanged.")
    setEditingId(null)
    await loadTemplates()
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    const result = await deleteMilestoneTemplateAction({ id })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Removed from upcoming projects. Existing stages are unchanged.")
    await loadTemplates()
  }

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Milestones"
          description="Master list of construction stages. New projects copy this list when construction starts. Existing project stages are not rewritten."
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
          <Card className="section-card max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Project stages
              </CardTitle>
              <CardDescription>
                Default budget split is {totalPercent.toFixed(2)}% across {templates.length}{" "}
                stages. Projects can still adjust percentages after they are created.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border p-2">
                {templates.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No stages yet.
                  </p>
                ) : (
                  templates.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-2"
                    >
                      <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      {editingId === item.id ? (
                        <>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8 flex-1"
                          />
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.25"
                            value={editingPercent}
                            onChange={(e) => setEditingPercent(e.target.value)}
                            className="h-8 w-20"
                          />
                        </>
                      ) : (
                        <>
                          <p className="min-w-0 flex-1 truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {item.expectedCostPercent}%
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
                                setEditingPercent(String(item.expectedCostPercent))
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
                                    New projects will not get this stage. Projects already in
                                    construction keep their current stages.
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
                <Label>Add stage</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Foundation"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAdd()
                    }}
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.25"
                    value={newPercent}
                    onChange={(e) => setNewPercent(e.target.value)}
                    className="sm:w-28"
                    aria-label="Default budget percent"
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
