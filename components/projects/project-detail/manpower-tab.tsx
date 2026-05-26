"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Plus,
  Users,
  ChevronDown,
  ChevronRight,
  IndianRupee,
  Settings2,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react"
import { toast } from "sonner"
import { formatINR } from "@/lib/currency"
import type { ManpowerPayload, ManpowerWeekView } from "@/lib/data/manpower"
import type { LabourType } from "@/lib/types/database"
import {
  createLabourTypeAction,
  createManpowerWeekAction,
  deleteLabourTypeAction,
  deleteManpowerWeekAction,
  updateLabourTypeAction,
  updateManpowerWeekRateAction,
  upsertManpowerCellAction,
} from "@/lib/projects/manpower-actions"

type ProjectStageOption = { id: string; name: string }

interface ManpowerTabProps {
  projectId: string
  projectStartDate?: string | null
  /** Stages from project detail — used for Add Week dropdown when API list is empty */
  projectMilestones?: ProjectStageOption[]
  readOnly?: boolean
}

type EditingCell = {
  weekId: string
  dayIso: string
  labourTypeId: string
} | null

export function ManpowerTab({
  projectId,
  projectStartDate,
  projectMilestones = [],
  readOnly = false,
}: ManpowerTabProps) {
  const [data, setData] = useState<ManpowerPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [saving, setSaving] = useState(false)

  const [addWeekOpen, setAddWeekOpen] = useState(false)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("")

  const [typesOpen, setTypesOpen] = useState(false)
  const [typeForm, setTypeForm] = useState({
    id: "",
    name: "",
    shortLabel: "",
    defaultWage: "",
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/manpower`, {
        credentials: "include",
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: ManpowerPayload
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error || "Failed to load manpower data.")
      }
      setData(json.data ?? null)
      setExpandedWeekId((current) => current ?? json.data?.weeks[0]?.id ?? null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load manpower.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const labourTypes = data?.labourTypes ?? []
  const weeks = data?.weeks ?? []
  const stageOptions = useMemo(() => {
    const byId = new Map<string, ProjectStageOption>()
    for (const m of projectMilestones) {
      byId.set(m.id, m)
    }
    for (const m of data?.milestones ?? []) {
      byId.set(m.id, m)
    }
    return Array.from(byId.values())
  }, [projectMilestones, data?.milestones])

  const handleAddWeek = async () => {
    if (!selectedMilestoneId) {
      toast.error("Select a project stage for this week.")
      return
    }
    setSaving(true)
    const result = await createManpowerWeekAction({
      projectId,
      milestoneId: selectedMilestoneId,
      projectStartDate,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Week added.")
    setAddWeekOpen(false)
    setSelectedMilestoneId("")
    setExpandedWeekId(result.data.weekId)
    await loadData()
  }

  const handleCellSave = async (
    week: ManpowerWeekView,
    dayIso: string,
    labourTypeId: string,
    value: string,
  ) => {
    const count = value === "" ? null : parseInt(value, 10)
    if (value !== "" && Number.isNaN(count as number)) return

    setSaving(true)
    const result = await upsertManpowerCellAction({
      projectId,
      weekId: week.id,
      labourTypeId,
      entryDate: dayIso,
      count,
    })
    setSaving(false)
    setEditingCell(null)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    await loadData()
  }

  const handleRateSave = async (
    weekId: string,
    labourTypeId: string,
    value: string,
  ) => {
    const dailyRate = parseFloat(value)
    if (Number.isNaN(dailyRate) || dailyRate < 0) {
      toast.error("Enter a valid daily rate.")
      return
    }

    setSaving(true)
    const result = await updateManpowerWeekRateAction({
      projectId,
      weekId,
      labourTypeId,
      dailyRate,
    })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }
    await loadData()
  }

  const openCreateType = () => {
    setTypeForm({ id: "", name: "", shortLabel: "", defaultWage: "" })
    setTypesOpen(true)
  }

  const openEditType = (type: LabourType) => {
    setTypeForm({
      id: type.id,
      name: type.name,
      shortLabel: type.short_label || "",
      defaultWage: String(type.default_wage),
    })
    setTypesOpen(true)
  }

  const handleSaveType = async () => {
    if (!typeForm.name.trim()) {
      toast.error("Labour type name is required.")
      return
    }
    const defaultWage = parseFloat(typeForm.defaultWage)
    if (Number.isNaN(defaultWage) || defaultWage < 0) {
      toast.error("Enter a valid default wage.")
      return
    }

    setSaving(true)
    const result = typeForm.id
      ? await updateLabourTypeAction({
          projectId,
          labourTypeId: typeForm.id,
          name: typeForm.name,
          shortLabel: typeForm.shortLabel,
          defaultWage,
        })
      : await createLabourTypeAction({
          projectId,
          name: typeForm.name,
          shortLabel: typeForm.shortLabel,
          defaultWage,
        })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(typeForm.id ? "Labour type updated." : "Labour type added.")
    setTypesOpen(false)
    await loadData()
  }

  const handleDeleteType = async (labourTypeId: string) => {
    setSaving(true)
    const result = await deleteLabourTypeAction({ projectId, labourTypeId })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Labour type deleted.")
    await loadData()
  }

  const handleDeleteWeek = async (weekId: string) => {
    setSaving(true)
    const result = await deleteManpowerWeekAction({ projectId, weekId })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Week deleted.")
    if (expandedWeekId === weekId) setExpandedWeekId(null)
    await loadData()
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading manpower...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Manpower</h2>
          <p className="text-sm text-muted-foreground">
            Weekly workforce by stage, with editable rates and daily counts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {readOnly && (
            <Badge variant="outline" className="text-muted-foreground">
              View only
            </Badge>
          )}
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" onClick={openCreateType}>
                <Settings2 className="mr-1 h-4 w-4" />
                Manage Types
              </Button>
              <Button size="sm" onClick={() => setAddWeekOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Week
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              Total Manpower
            </span>
          </div>
          <p className="mt-1 text-xl font-bold">{data?.totals.manpower ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <IndianRupee className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              Total Payment
            </span>
          </div>
          <p className="mt-1 text-xl font-bold text-primary">
            {formatINR(data?.totals.payment ?? 0)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {weeks.map((week) => {
          const isExpanded = expandedWeekId === week.id
          return (
            <div
              key={week.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between gap-2 p-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedWeekId(isExpanded ? null : week.id)
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Week {week.weekNumber}</span>
                      <Badge variant="secondary">{week.milestoneName}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {week.days[0]?.label} - {week.days[6]?.label}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-bold text-primary">
                      {formatINR(week.weekTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {week.manpowerTotal} workers
                    </p>
                  </div>
                  {!readOnly && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete week?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes Week {week.weekNumber} and all daily
                            counts for {week.milestoneName}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void handleDeleteWeek(week.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="sticky left-0 z-10 bg-muted/30 px-2 py-2 text-left text-[10px] font-semibold uppercase text-muted-foreground">
                            Day
                          </th>
                          {labourTypes.map((type) => (
                            <th
                              key={type.id}
                              className="px-1 py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground"
                            >
                              <div>{type.short_label || type.name}</div>
                              {!readOnly ? (
                                <Input
                                  type="number"
                                  min="0"
                                  className="mx-auto mt-1 h-7 w-16 px-1 text-center text-[10px]"
                                  defaultValue={week.rates[type.id] ?? type.default_wage}
                                  onBlur={(e) =>
                                    void handleRateSave(
                                      week.id,
                                      type.id,
                                      e.target.value,
                                    )
                                  }
                                />
                              ) : (
                                <div className="mt-1 text-[10px] font-normal">
                                  {formatINR(week.rates[type.id] ?? type.default_wage)}
                                </div>
                              )}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase text-muted-foreground">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {week.days.map((row) => {
                          const isSunday = row.day === "Sun"
                          return (
                            <tr key={row.iso} className={isSunday ? "bg-primary/5" : ""}>
                              <td
                                className={`sticky left-0 z-10 px-2 py-1.5 ${
                                  isSunday ? "bg-primary/5" : "bg-card"
                                }`}
                              >
                                <div className="font-medium">{row.day}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {row.label}
                                </div>
                              </td>
                              {labourTypes.map((type) => {
                                const isEditing =
                                  !readOnly &&
                                  editingCell?.weekId === week.id &&
                                  editingCell.dayIso === row.iso &&
                                  editingCell.labourTypeId === type.id
                                const value = row.workers[type.id]

                                return (
                                  <td
                                    key={type.id}
                                    className="px-0.5 py-1"
                                    onClick={() => {
                                      if (readOnly || saving) return
                                      setEditingCell({
                                        weekId: week.id,
                                        dayIso: row.iso,
                                        labourTypeId: type.id,
                                      })
                                    }}
                                  >
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        autoFocus
                                        className="mx-auto h-7 w-10 p-1 text-center text-xs"
                                        defaultValue={value ?? ""}
                                        onBlur={(e) =>
                                          void handleCellSave(
                                            week,
                                            row.iso,
                                            type.id,
                                            e.target.value,
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === "Escape") {
                                            ;(e.target as HTMLInputElement).blur()
                                          }
                                        }}
                                      />
                                    ) : (
                                      <div
                                        className={`mx-auto flex h-7 w-10 items-center justify-center rounded text-xs ${
                                          value
                                            ? "bg-primary/10 font-semibold text-primary"
                                            : "text-muted-foreground/40"
                                        } ${readOnly ? "" : "cursor-pointer hover:bg-muted"}`}
                                      >
                                        {value ?? "-"}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="px-2 py-1.5 text-right">
                                <span
                                  className={`text-xs font-semibold ${
                                    row.dayTotal > 0
                                      ? "text-primary"
                                      : "text-muted-foreground/40"
                                  }`}
                                >
                                  {row.dayTotal > 0
                                    ? formatINR(row.dayTotal)
                                    : "-"}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-muted/50">
                          <td className="sticky left-0 z-10 bg-muted/50 px-2 py-2 text-xs font-bold">
                            Total
                          </td>
                          {labourTypes.map((type) => (
                            <td key={type.id} className="px-0.5 py-2 text-center text-xs font-bold">
                              {week.columnTotals[type.id] || "-"}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-right text-xs font-bold text-primary">
                            {formatINR(week.weekTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {!readOnly && (
                    <div className="border-t border-border bg-muted/20 px-3 py-2 text-center text-[10px] text-muted-foreground">
                      Edit rates in the header row. Tap a cell to enter worker count.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {weeks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="font-semibold">No weeks added yet</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {readOnly
              ? "Manpower entries will appear here once a PM, admin, or site engineer adds them."
              : "Add a week, choose the stage, then enter daily worker counts."}
          </p>
        </div>
      )}

      <Dialog open={addWeekOpen} onOpenChange={setAddWeekOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Week</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Project stage</Label>
            {stageOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No stages found for this project. Add stages on the Stages tab
                first, then return here to add a week.
              </p>
            ) : (
              <Select
                value={selectedMilestoneId}
                onValueChange={setSelectedMilestoneId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select stage for this week" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {stageOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddWeekOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleAddWeek()}
              disabled={saving || stageOptions.length === 0}
            >
              {saving ? "Adding..." : "Add Week"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={typesOpen} onOpenChange={setTypesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {typeForm.id ? "Edit Labour Type" : "Manage Labour Types"}
            </DialogTitle>
          </DialogHeader>

          {typeForm.id && !readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit px-0"
              onClick={() =>
                setTypeForm({ id: "", name: "", shortLabel: "", defaultWage: "" })
              }
            >
              Back to list
            </Button>
          )}

          {!typeForm.id && (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
              {labourTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-2"
                >
                  <div>
                    <p className="font-medium text-sm">{type.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {type.short_label} · {formatINR(Number(type.default_wage))}/day
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditType(type)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {type.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Only types with no entries can be deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void handleDeleteType(type.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!readOnly && (
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={typeForm.name}
                  onChange={(e) =>
                    setTypeForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Mason"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Short label</Label>
                  <Input
                    value={typeForm.shortLabel}
                    onChange={(e) =>
                      setTypeForm((prev) => ({
                        ...prev,
                        shortLabel: e.target.value,
                      }))
                    }
                    placeholder="Mason"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default wage (₹/day)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={typeForm.defaultWage}
                    onChange={(e) =>
                      setTypeForm((prev) => ({
                        ...prev,
                        defaultWage: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTypesOpen(false)}>
              Close
            </Button>
            {!readOnly && (
              <Button onClick={() => void handleSaveType()} disabled={saving}>
                {saving
                  ? "Saving..."
                  : typeForm.id
                    ? "Save Type"
                    : "Add Type"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
