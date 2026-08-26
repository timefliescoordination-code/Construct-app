"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  HardHat,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { cn } from "@/lib/utils"
import type { LabourTeam, LabourType } from "@/lib/types/database"
import {
  createCompanyLabourTeamAction,
  createCompanyLabourTypeAction,
  deleteCompanyLabourTeamAction,
  deleteCompanyLabourTypeAction,
  getCompanyLabourCatalogAction,
  updateCompanyLabourTeamAction,
  updateCompanyLabourTypeAction,
} from "@/lib/labour-types/actions"

export function LabourSettingsContent() {
  const router = useRouter()
  const { isAdmin, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teams, setTeams] = useState<LabourTeam[]>([])
  const [types, setTypes] = useState<LabourType[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const [newTeamName, setNewTeamName] = useState("")
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState("")

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

  const loadCatalog = useCallback(async () => {
    const result = await getCompanyLabourCatalogAction()
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setTeams(result.data.teams)
    setTypes(result.data.types)
    setSelectedTeamId((current) => {
      if (current && result.data.teams.some((team) => team.id === current)) {
        return current
      }
      return result.data.teams[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    void loadCatalog().finally(() => setLoading(false))
  }, [isAdmin, loadCatalog])

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null
  const linkedTypes = useMemo(
    () => types.filter((type) => type.labour_team_id === selectedTeamId),
    [types, selectedTeamId],
  )
  const typeCountByTeam = useMemo(() => {
    const counts = new Map<string, number>()
    for (const type of types) {
      if (!type.labour_team_id) continue
      counts.set(type.labour_team_id, (counts.get(type.labour_team_id) ?? 0) + 1)
    }
    return counts
  }, [types])

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error("Team name is required.")
      return
    }
    setSaving(true)
    const result = await createCompanyLabourTeamAction({ name: newTeamName })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Labour team added on every project.")
    setNewTeamName("")
    await loadCatalog()
    setSelectedTeamId(result.data.id)
  }

  const handleSaveTeam = async () => {
    if (!editingTeamId) return
    setSaving(true)
    const result = await updateCompanyLabourTeamAction({
      labourTeamId: editingTeamId,
      name: editingTeamName,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Team updated everywhere.")
    setEditingTeamId(null)
    await loadCatalog()
  }

  const handleDeleteTeam = async (id: string) => {
    setSaving(true)
    const result = await deleteCompanyLabourTeamAction({ labourTeamId: id })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Team removed from every project.")
    if (selectedTeamId === id) setSelectedTeamId(null)
    await loadCatalog()
  }

  const handleAddType = async () => {
    if (!selectedTeamId) {
      toast.error("Select a labour team first.")
      return
    }
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
      labourTeamId: selectedTeamId,
      name: newName,
      shortLabel: newShortLabel,
      defaultWage,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Labour type linked on every project.")
    setNewName("")
    setNewShortLabel("")
    setNewWage("")
    await loadCatalog()
  }

  const handleSaveType = async () => {
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
    await loadCatalog()
  }

  const handleDeleteType = async (id: string) => {
    setSaving(true)
    const result = await deleteCompanyLabourTypeAction({ labourTypeId: id })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Removed from every project.")
    await loadCatalog()
  }

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Manage labours"
          description="One catalogue for expense labour teams and manpower roles. Weekly manpower posts into expenses only when Show in expense is turned on for that week."
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
          <div className="grid gap-4 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
            <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-muted/30 px-4 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight">Labour teams</h2>
                    <p className="text-xs text-muted-foreground">
                      {teams.length} teams · used in Labour expenses
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-2">
                {teams.length === 0 ? (
                  <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Add a labour team to get started.
                  </p>
                ) : (
                  teams.map((team) => {
                    const selected = team.id === selectedTeamId
                    return (
                      <div
                        key={team.id}
                        className={cn(
                          "group flex items-center gap-1 rounded-xl border px-2 py-1.5 transition-colors",
                          selected
                            ? "border-primary/30 bg-primary/10"
                            : "border-transparent hover:bg-muted/60",
                        )}
                      >
                        {editingTeamId === team.id ? (
                          <Input
                            value={editingTeamName}
                            onChange={(e) => setEditingTeamName(e.target.value)}
                            className="h-8 flex-1"
                            aria-label="Team name"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleSaveTeam()
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedTeamId(team.id)}
                            className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
                          >
                            <p className="truncate text-sm font-medium">{team.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {typeCountByTeam.get(team.id) ?? 0} linked roles
                            </p>
                          </button>
                        )}
                        <div
                          className={cn(
                            "flex shrink-0",
                            editingTeamId === team.id
                              ? "opacity-100"
                              : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                          )}
                        >
                          {editingTeamId === team.id ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8"
                              disabled={saving}
                              onClick={() => void handleSaveTeam()}
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
                                  setEditingTeamId(team.id)
                                  setEditingTeamName(team.name)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {team.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This removes the team and its roles from every project.
                                      Teams with labour expenses or manpower entries cannot be
                                      deleted.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => void handleDeleteTeam(team.id)}
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
                    )
                  })
                )}
              </div>
              <div className="border-t border-border p-3">
                <Label className="sr-only">Add labour team</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Add a team, e.g. Civil Team"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddTeam()
                    }}
                  />
                  <Button onClick={() => void handleAddTeam()} disabled={saving}>
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
            </section>

            <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {selectedTeam ? (
                <>
                  <div className="border-b border-border bg-muted/30 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <HardHat className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold tracking-tight">
                          {selectedTeam.name}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {linkedTypes.length} linked labour types · used on the manpower sheet
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {linkedTypes.length === 0 ? (
                      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
                        <HardHat className="mb-2 h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm font-medium">No linked labour yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Add Head Mason, Mason, Helper, and other roles for this team.
                        </p>
                      </div>
                    ) : (
                      linkedTypes.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center"
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
                              <span className="shrink-0 rounded-md bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
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
                                onClick={() => void handleSaveType()}
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
                                        This removes the role from {selectedTeam.name} on every
                                        project. Types that already have manpower entries cannot
                                        be deleted.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => void handleDeleteType(item.id)}
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
                  <div className="border-t border-border p-3">
                    <Label>Add labour type</Label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Head Mason"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleAddType()
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
                      <Button onClick={() => void handleAddType()} disabled={saving}>
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
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Select a labour team</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Linked roles for that team will appear here, and they will be the same list
                    used on manpower.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </PageMain>
    </PageShell>
  )
}
