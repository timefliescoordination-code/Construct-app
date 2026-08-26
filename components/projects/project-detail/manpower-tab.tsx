"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  Calendar,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { formatINR } from "@/lib/currency"
import { cn } from "@/lib/utils"
import {
  formatWeekRangeLabel,
  nextWeekStartDate,
  toIsoDate,
  weekStartIsoFromPickerDate,
} from "@/lib/manpower/dates"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ManpowerPayload, ManpowerWeekView } from "@/lib/data/manpower"
import type { LabourTeamExpenseSummary } from "@/lib/data/labour-teams"
import { useAuth } from "@/lib/hooks/use-auth"
import { LabourTeamExpenseStrip } from "@/components/projects/project-detail/labour-team-expense-strip"
import {
  createManpowerWeekAction,
  deleteManpowerWeekAction,
  setManpowerWeekShowInExpenseAction,
  updateManpowerWeekRateAction,
  upsertManpowerCellAction,
} from "@/lib/projects/manpower-actions"

const UNASSIGNED_TEAM_ID = "__unassigned__"

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
  const { isAdmin } = useAuth()
  const [data, setData] = useState<ManpowerPayload | null>(null)
  const [teamSummaries, setTeamSummaries] = useState<LabourTeamExpenseSummary[]>([])
  const [totalApprovedLabour, setTotalApprovedLabour] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [saving, setSaving] = useState(false)

  const [addWeekOpen, setAddWeekOpen] = useState(false)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("")
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date | undefined>()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [manpowerRes, teamsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/manpower`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/projects/${projectId}/labour-teams`, {
          credentials: "include",
          cache: "no-store",
        }),
      ])

      const json = (await manpowerRes.json().catch(() => ({}))) as {
        data?: ManpowerPayload
        error?: string
      }
      if (!manpowerRes.ok) {
        throw new Error(json.error || "Failed to load manpower data.")
      }
      setData(json.data ?? null)
      setExpandedWeekId((current) => current ?? json.data?.weeks[0]?.id ?? null)

      const teamsJson = (await teamsRes.json().catch(() => ({}))) as {
        data?: {
          summaries: LabourTeamExpenseSummary[]
          totalApprovedLabour: number
        }
      }
      if (teamsRes.ok && teamsJson.data) {
        setTeamSummaries(teamsJson.data.summaries)
        setTotalApprovedLabour(teamsJson.data.totalApprovedLabour)
      }
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

  const allLabourTypes = data?.labourTypes ?? []
  const labourTeams = data?.labourTeams ?? []
  const teamOptions = useMemo(() => {
    const withRoles = labourTeams.filter((team) =>
      allLabourTypes.some((type) => type.labour_team_id === team.id),
    )
    const hasUnassigned = allLabourTypes.some((type) => !type.labour_team_id)
    return { teams: withRoles, hasUnassigned }
  }, [labourTeams, allLabourTypes])

  useEffect(() => {
    if (selectedTeamId) {
      const exists =
        selectedTeamId === UNASSIGNED_TEAM_ID
          ? teamOptions.hasUnassigned
          : teamOptions.teams.some((team) => team.id === selectedTeamId)
      if (exists) return
    }
    setSelectedTeamId(
      teamOptions.teams[0]?.id ?? (teamOptions.hasUnassigned ? UNASSIGNED_TEAM_ID : null),
    )
  }, [selectedTeamId, teamOptions])

  const labourTypes = allLabourTypes.filter((type) =>
    selectedTeamId === UNASSIGNED_TEAM_ID
      ? !type.labour_team_id
      : type.labour_team_id === selectedTeamId,
  )
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

  const existingWeekStarts = useMemo(
    () => new Set(weeks.map((week) => week.startDate)),
    [weeks],
  )

  const selectedWeekStartIso = selectedWeekDate
    ? weekStartIsoFromPickerDate(selectedWeekDate)
    : null

  const selectedWeekRangeLabel = selectedWeekStartIso
    ? formatWeekRangeLabel(selectedWeekStartIso)
    : null

  const isDuplicateSelectedWeek =
    selectedWeekStartIso != null && existingWeekStarts.has(selectedWeekStartIso)

  const openAddWeekDialog = () => {
    const existingStarts = weeks.map((week) => week.startDate)
    const suggestedIso = nextWeekStartDate(projectStartDate, existingStarts)
    setSelectedWeekDate(new Date(`${suggestedIso}T00:00:00`))
    setSelectedMilestoneId(stageOptions[0]?.id ?? "")
    setAddWeekOpen(true)
  }

  const handleAddWeek = async () => {
    if (!selectedMilestoneId) {
      toast.error("Select a project stage for this week.")
      return
    }
    if (!selectedWeekDate) {
      toast.error("Select a week on the calendar.")
      return
    }
    if (isDuplicateSelectedWeek) {
      toast.error("This week is already on the manpower sheet. Pick another date.")
      return
    }
    setSaving(true)
    const result = await createManpowerWeekAction({
      projectId,
      milestoneId: selectedMilestoneId,
      projectStartDate,
      weekStartDate: toIsoDate(selectedWeekDate),
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Week added.")
    setAddWeekOpen(false)
    setSelectedMilestoneId("")
    setSelectedWeekDate(undefined)
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

  const handleShowInExpense = async (weekId: string, showInExpense: boolean) => {
    setSaving(true)
    const result = await setManpowerWeekShowInExpenseAction({
      projectId,
      weekId,
      showInExpense,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(
      showInExpense
        ? "This week will post to Labour expenses."
        : "This week is hidden from expenses.",
    )
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
            Weekly workforce by team. Turn on Show in expense to post the week into Labour
            expenses.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {readOnly && (
            <Badge variant="outline" className="text-muted-foreground">
              View only
            </Badge>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/settings/labours">
                <Settings2 className="mr-1 h-4 w-4" />
                Manage labours
              </Link>
            </Button>
          )}
          {!readOnly && (
            <Button size="sm" onClick={openAddWeekDialog}>
              <Plus className="mr-1 h-4 w-4" />
              Add Week
            </Button>
          )}
        </div>
      </div>

      {teamSummaries.length > 0 && (
        <LabourTeamExpenseStrip
          summaries={teamSummaries}
          totalApprovedLabour={totalApprovedLabour}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
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

      {(teamOptions.teams.length > 0 || teamOptions.hasUnassigned) && (
        <div className="flex flex-wrap gap-1.5">
          {teamOptions.teams.map((team) => {
            const selected = selectedTeamId === team.id
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedTeamId(team.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {team.name}
              </button>
            )
          })}
          {teamOptions.hasUnassigned && (
            <button
              type="button"
              onClick={() => setSelectedTeamId(UNASSIGNED_TEAM_ID)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                selectedTeamId === UNASSIGNED_TEAM_ID
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              Other
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {weeks.map((week) => {
          const isExpanded = expandedWeekId === week.id
          const teamDayTotal = (workers: Record<string, number | null>) =>
            labourTypes.reduce((sum, type) => {
              const count = workers[type.id] || 0
              return sum + count * (week.rates[type.id] ?? Number(type.default_wage))
            }, 0)
          const teamWeekTotal = week.days.reduce(
            (sum, row) => sum + teamDayTotal(row.workers),
            0,
          )
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
                <div className="flex items-center gap-3">
                  {!readOnly && (
                    <div
                      className="hidden items-center gap-2 sm:flex"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Switch
                        id={`show-expense-${week.id}`}
                        checked={week.showInExpense}
                        disabled={saving}
                        onCheckedChange={(checked) =>
                          void handleShowInExpense(week.id, checked)
                        }
                      />
                      <Label
                        htmlFor={`show-expense-${week.id}`}
                        className="cursor-pointer text-[11px] font-medium text-muted-foreground"
                      >
                        Show in expense
                      </Label>
                    </div>
                  )}
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
                                    teamDayTotal(row.workers) > 0
                                      ? "text-primary"
                                      : "text-muted-foreground/40"
                                  }`}
                                >
                                  {teamDayTotal(row.workers) > 0
                                    ? formatINR(teamDayTotal(row.workers))
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
                            {formatINR(teamWeekTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {!readOnly && (
                    <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center justify-center gap-2 sm:hidden">
                        <Switch
                          id={`show-expense-mobile-${week.id}`}
                          checked={week.showInExpense}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            void handleShowInExpense(week.id, checked)
                          }
                        />
                        <Label
                          htmlFor={`show-expense-mobile-${week.id}`}
                          className="text-[11px] font-medium text-muted-foreground"
                        >
                          Show in expense
                        </Label>
                      </div>
                      <p className="text-center text-[10px] text-muted-foreground sm:text-left">
                        Edit rates in the header row. Tap a cell to enter worker count.
                        Show in expense posts this week into Labour expenses.
                      </p>
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

      <Dialog
        open={addWeekOpen}
        onOpenChange={(open) => {
          setAddWeekOpen(open)
          if (!open) {
            setSelectedMilestoneId("")
            setSelectedWeekDate(undefined)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Week</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Week</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedWeekDate && "text-muted-foreground",
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4 shrink-0" />
                    {selectedWeekDate
                      ? format(selectedWeekDate, "PPP")
                      : "Pick a date in the week"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={selectedWeekDate}
                    onSelect={setSelectedWeekDate}
                    defaultMonth={selectedWeekDate}
                    initialFocus
                    disabled={(date) =>
                      existingWeekStarts.has(weekStartIsoFromPickerDate(date))
                    }
                  />
                </PopoverContent>
              </Popover>
              {selectedWeekRangeLabel && (
                <p
                  className={cn(
                    "text-sm",
                    isDuplicateSelectedWeek
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {isDuplicateSelectedWeek
                    ? "This week already exists. Choose another date."
                    : `Work week: ${selectedWeekRangeLabel} (Mon–Sun)`}
                </p>
              )}
            </div>
            <div className="space-y-2">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddWeekOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleAddWeek()}
              disabled={
                saving ||
                stageOptions.length === 0 ||
                !selectedWeekDate ||
                isDuplicateSelectedWeek
              }
            >
              {saving ? "Adding..." : "Add Week"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
