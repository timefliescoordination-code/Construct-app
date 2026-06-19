"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  Truck,
  History,
  Loader2
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { format, isSameDay, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useProjectDetailsList } from "@/lib/hooks/use-project-data"
import type { ProjectWithDetails } from "@/lib/types/database"
import { NO_ASSIGNED_PROJECT_MESSAGE } from "@/lib/project-access"
import { deriveProjectIdleStatus, projectIdleFromProject } from "@/lib/project-idle"
import { ProjectIdleBadge } from "@/components/projects/project-idle-badge"
import { createExpenseAction } from "@/lib/projects/tab-actions"
import { canEnterManpowerData } from "@/lib/permissions"
import { useAuth } from "@/lib/hooks/use-auth"
import { toast } from "sonner"
import { useExpenseShortcutRegistryOptional } from "@/lib/keyboard/expense-shortcut-context"
import type { MandatoryFieldDef } from "@/lib/keyboard/mandatory-expense-fields"
import {
  MandatoryExpenseKeyboardProvider,
  MandatoryExpenseSubmitButton,
  useMandatoryExpenseKeyboard,
} from "@/lib/keyboard/mandatory-expense-keyboard"
import { ExpenseBulkEntryDialog } from "@/components/expense/expense-bulk-entry-dialog"
import { DashboardHeader } from "@/components/dashboard/header"
import { MetricCard } from "@/components/layout/metric-card"
import {
  CONTENT_SIDEBAR_GRID_CLASS,
  CONTENT_SIDEBAR_MAIN_CLASS,
  PageHeader,
  PageMain,
  PageShell,
  STATS_GRID_CLASS,
} from "@/components/layout/page"
const SHOW_ALL_PROJECTS = "all"
const ENGINEER_PROJECT_STORAGE_KEY = "engineer-dashboard-project"

function parseExpenseDate(value: string | null | undefined): Date {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) return new Date(0)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseISO(trimmed)
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

function expenseDateMs(value: string | null | undefined): number {
  return parseExpenseDate(value).getTime()
}

function isExpenseToday(
  expenseDate: string | null | undefined,
  today: Date,
): boolean {
  const trimmed = String(expenseDate ?? "").trim()
  if (!trimmed) return false
  return isSameDay(parseExpenseDate(trimmed), today)
}

type EngineerExpenseRow = {
  id: string
  time: string
  category: string
  description: string
  vendor: string
  amount: number
  status: string
  projectName?: string
}

type EngineerDashboardView = {
  showAll: boolean
  activeProject: ProjectWithDetails | null
  projectName: string
  siteAddress: string
  currentMilestone: ProjectWithDetails["milestones"][number] | null
  milestones: { id: string; name: string; status: string }[]
  todayExpenses: EngineerExpenseRow[]
  allExpenses: EngineerExpenseRow[]
  totalTodayExpenses: number
  pendingCount: number
  labourCount: number
  activeVendors: number
  idle: ReturnType<typeof projectIdleFromProject>
}

function mapExpenseRow(
  exp: ProjectWithDetails["expenses"][number],
  projectName?: string,
): EngineerExpenseRow {
  return {
    id: exp.id,
    time: exp.expense_date ?? "",
    category: exp.category ?? "Uncategorized",
    description: exp.description ?? "",
    vendor: exp.vendor_name?.trim() || "N/A",
    amount: Number(exp.amount) || 0,
    status: exp.status ?? "pending",
    projectName,
  }
}

function buildViewFromProject(project: ProjectWithDetails): EngineerDashboardView {
  const today = new Date()
  const expenses = project.expenses ?? []
  const milestoneRows = project.milestones ?? []
  const currentMilestone =
    milestoneRows.find((ms) => ms.status === "in-progress") ?? null
  const milestones = milestoneRows.map((ms) => ({
    id: ms.id,
    name: ms.name,
    status: ms.status,
  }))

  const todayExpenses = expenses
    .filter((exp) => isExpenseToday(exp.expense_date, today))
    .sort((a, b) => expenseDateMs(b.expense_date) - expenseDateMs(a.expense_date))
    .map((exp) => mapExpenseRow(exp))

  const allExpenses = [...expenses]
    .sort((a, b) => expenseDateMs(b.expense_date) - expenseDateMs(a.expense_date))
    .map((exp) => mapExpenseRow(exp))

  const pendingCount = expenses.filter((exp) => exp.status === "pending").length
  const activeVendors = new Set(
    todayExpenses.map((exp) => exp.vendor).filter((name) => name !== "N/A"),
  ).size

  return {
    showAll: false,
    activeProject: project,
    projectName: project.name ?? "Unnamed project",
    siteAddress: project.site_address ?? "",
    currentMilestone,
    milestones,
    todayExpenses,
    allExpenses,
    totalTodayExpenses: todayExpenses.reduce((sum, exp) => sum + exp.amount, 0),
    pendingCount,
    labourCount: project.labour_workers_today ?? 0,
    activeVendors,
    idle: projectIdleFromProject({
      start_date: project.start_date,
      status: project.status,
      expenses: expenses.map((exp) => ({ expense_date: exp.expense_date })),
    }),
  }
}

function buildViewFromAllProjects(projects: ProjectWithDetails[]): EngineerDashboardView {
  const today = new Date()
  const todayExpenses = projects.flatMap((project) =>
    (project.expenses ?? [])
      .filter((exp) => isExpenseToday(exp.expense_date, today))
      .sort((a, b) => expenseDateMs(b.expense_date) - expenseDateMs(a.expense_date))
      .map((exp) => mapExpenseRow(exp, project.name ?? "Unnamed project")),
  )

  const allExpenses = projects.flatMap((project) =>
    [...(project.expenses ?? [])]
      .sort((a, b) => expenseDateMs(b.expense_date) - expenseDateMs(a.expense_date))
      .map((exp) => mapExpenseRow(exp, project.name ?? "Unnamed project")),
  )

  const pendingCount = projects.reduce(
    (sum, project) =>
      sum + (project.expenses ?? []).filter((exp) => exp.status === "pending").length,
    0,
  )

  const activeVendors = new Set(
    todayExpenses.map((exp) => exp.vendor).filter((name) => name !== "N/A"),
  ).size

  const labourCount = projects.reduce(
    (sum, project) => sum + (project.labour_workers_today ?? 0),
    0,
  )

  const count = projects.length
  const idlePerProject = projects.map((project) =>
    projectIdleFromProject({
      start_date: project.start_date,
      status: project.status,
      expenses: (project.expenses ?? []).map((exp) => ({
        expense_date: exp.expense_date,
      })),
    }),
  )
  const idle = idlePerProject.reduce(
    (worst, current) =>
      current.isIdle && current.days > worst.days ? current : worst,
    idlePerProject[0] ?? deriveProjectIdleStatus({ status: "active" }),
  )

  return {
    showAll: true,
    activeProject: null,
    projectName: `All sites (${count})`,
    siteAddress: `${count} assigned project${count === 1 ? "" : "s"}`,
    currentMilestone: null,
    milestones: [],
    todayExpenses,
    allExpenses,
    totalTodayExpenses: todayExpenses.reduce((sum, exp) => sum + exp.amount, 0),
    pendingCount,
    labourCount,
    activeVendors,
    idle,
  }
}

const ENGINEER_CATEGORY_OPTIONS = [
  { value: "Materials", label: "Materials" },
  { value: "Labour", label: "Labour" },
  { value: "Equipment", label: "Equipment" },
  { value: "Miscellaneous", label: "Miscellaneous" },
]

function EngineerAddExpenseForm({
  expenseForm,
  setExpenseForm,
  milestones,
}: {
  expenseForm: {
    category: string
    description: string
    amount: string
    vendor: string
    milestoneId: string
  }
  setExpenseForm: React.Dispatch<
    React.SetStateAction<{
      category: string
      description: string
      amount: string
      vendor: string
      milestoneId: string
    }>
  >
  milestones: { id: string; name: string }[]
}) {
  const kb = useMandatoryExpenseKeyboard()
  const milestoneBind = kb?.bindSelect("milestone")
  const categoryBind = kb?.bindSelect("category")
  const descriptionBind = kb?.bindText("description")
  const vendorBind = kb?.bindText("vendor")
  const amountBind = kb?.bindText("amount")

  const visibleCategories = ENGINEER_CATEGORY_OPTIONS.filter(
    (opt) => categoryBind?.isOptionVisible(opt.label, opt.value) ?? true,
  )
  const visibleMilestones = milestones.filter(
    (ms) => milestoneBind?.isOptionVisible(ms.name, ms.id) ?? true,
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Stage</Label>
          <Select
            value={expenseForm.milestoneId}
            onValueChange={(v) => setExpenseForm({ ...expenseForm, milestoneId: v })}
            open={milestoneBind?.open}
            onOpenChange={milestoneBind?.onOpenChange}
          >
            <SelectTrigger
              ref={milestoneBind?.triggerRef}
              className={cn(milestoneBind?.typePrefix && "ring-1 ring-primary/40")}
              onKeyDown={milestoneBind?.onTriggerKeyDown}
            >
              {milestoneBind?.typePrefix ? (
                <span className="truncate text-muted-foreground text-sm">
                  type to filter…
                </span>
              ) : (
                <SelectValue placeholder="Select stage" />
              )}
            </SelectTrigger>
            <SelectContent>
              {milestoneBind?.typePrefix ? (
                <div className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
                  Filter:{" "}
                  <kbd className="rounded border bg-muted px-1 font-mono">
                    {milestoneBind.typePrefix}
                  </kbd>
                </div>
              ) : null}
              {visibleMilestones.length === 0 && milestoneBind?.typePrefix ? (
                <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                  No matches — Backspace to edit
                </p>
              ) : (
                visibleMilestones.map((ms) => (
                  <SelectItem key={ms.id} value={ms.id}>
                    {ms.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={expenseForm.category}
            onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}
            open={categoryBind?.open}
            onOpenChange={categoryBind?.onOpenChange}
          >
            <SelectTrigger
              ref={categoryBind?.triggerRef}
              className={cn(categoryBind?.typePrefix && "ring-1 ring-primary/40")}
              onKeyDown={categoryBind?.onTriggerKeyDown}
            >
              {categoryBind?.typePrefix ? (
                <span className="truncate text-muted-foreground text-sm">
                  type to filter…
                </span>
              ) : (
                <SelectValue placeholder="Select category" />
              )}
            </SelectTrigger>
            <SelectContent>
              {categoryBind?.typePrefix ? (
                <div className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
                  Filter:{" "}
                  <kbd className="rounded border bg-muted px-1 font-mono">
                    {categoryBind.typePrefix}
                  </kbd>
                </div>
              ) : null}
              {visibleCategories.length === 0 && categoryBind?.typePrefix ? (
                <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                  No matches — Backspace to edit
                </p>
              ) : (
                visibleCategories.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={expenseForm.description}
            onChange={(e) =>
              setExpenseForm({ ...expenseForm, description: e.target.value })
            }
            placeholder="e.g., Cement - 50 bags"
            ref={descriptionBind?.ref}
            onKeyDown={descriptionBind?.onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label>Vendor Name</Label>
          <Input
            value={expenseForm.vendor}
            onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
            placeholder="Vendor name"
            ref={vendorBind?.ref}
            onKeyDown={vendorBind?.onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label>Amount (₹)</Label>
          <Input
            type="number"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            placeholder="0"
            ref={amountBind?.ref}
            onKeyDown={amountBind?.onKeyDown}
          />
        </div>
      </div>
    </div>
  )
}

export function EngineerDashboard() {
  const { role } = useAuth()
  const canUseManpower = canEnterManpowerData(role)
  const expenseShortcuts = useExpenseShortcutRegistryOptional()
  const { projects: assignedProjects, isLoading, error, mutate } = useProjectDetailsList()
  const [selectedProjectId, setSelectedProjectId] = useState(SHOW_ALL_PROJECTS)
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isBulkEntryOpen, setIsBulkEntryOpen] = useState(false)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    description: '',
    amount: '',
    vendor: '',
    milestoneId: ''
  })

  const effectiveProjectId = useMemo(() => {
    if (!assignedProjects.length) return SHOW_ALL_PROJECTS
    if (assignedProjects.length === 1) return assignedProjects[0].id
    if (selectedProjectId === SHOW_ALL_PROJECTS) return SHOW_ALL_PROJECTS
    if (assignedProjects.some((project) => project.id === selectedProjectId)) {
      return selectedProjectId
    }
    return SHOW_ALL_PROJECTS
  }, [assignedProjects, selectedProjectId])

  useEffect(() => {
    if (!assignedProjects.length) return
    if (assignedProjects.length === 1) {
      setSelectedProjectId(assignedProjects[0].id)
      return
    }

    if (assignedProjects.some((project) => project.id === selectedProjectId)) {
      return
    }

    if (selectedProjectId === SHOW_ALL_PROJECTS) return

    try {
      const stored = localStorage.getItem(ENGINEER_PROJECT_STORAGE_KEY)
      if (
        stored === SHOW_ALL_PROJECTS ||
        assignedProjects.some((project) => project.id === stored)
      ) {
        setSelectedProjectId(stored ?? SHOW_ALL_PROJECTS)
        return
      }
    } catch {
      // ignore storage errors
    }

    setSelectedProjectId(SHOW_ALL_PROJECTS)
  }, [assignedProjects, selectedProjectId])

  const engineerData = useMemo((): EngineerDashboardView | null => {
    if (!assignedProjects.length) return null

    if (effectiveProjectId === SHOW_ALL_PROJECTS) {
      return buildViewFromAllProjects(assignedProjects)
    }

    const project = assignedProjects.find((p) => p.id === effectiveProjectId)
    if (!project) {
      return buildViewFromAllProjects(assignedProjects)
    }

    return buildViewFromProject(project)
  }, [assignedProjects, effectiveProjectId])

  const engineerMandatoryFields = useMemo((): MandatoryFieldDef[] => {
    const milestoneOptions = (engineerData?.milestones ?? []).map((ms) => ({
      value: ms.id,
      label: ms.name,
    }))
    return [
      {
        id: "milestone",
        kind: "select",
        skip: milestoneOptions.length === 0,
        options: milestoneOptions,
        getValue: () => expenseForm.milestoneId,
        setValue: (value) =>
          setExpenseForm((prev) => ({ ...prev, milestoneId: value })),
      },
      {
        id: "category",
        kind: "select",
        options: ENGINEER_CATEGORY_OPTIONS,
        getValue: () => expenseForm.category,
        setValue: (value) =>
          setExpenseForm((prev) => ({ ...prev, category: value })),
        validate: () => (expenseForm.category ? null : "Select category"),
      },
      {
        id: "description",
        kind: "text",
        validate: () =>
          expenseForm.description.trim() ? null : "Enter description",
      },
      {
        id: "vendor",
        kind: "text",
      },
      {
        id: "amount",
        kind: "number",
        validate: () => {
          const amount = parseFloat(expenseForm.amount)
          return Number.isFinite(amount) && amount > 0 ? null : "Enter amount"
        },
      },
    ]
  }, [
    engineerData?.milestones,
    expenseForm.category,
    expenseForm.description,
    expenseForm.amount,
    expenseForm.milestoneId,
    expenseForm.vendor,
  ])

  useEffect(() => {
    if (!expenseShortcuts || engineerData?.showAll) return
    return expenseShortcuts.registerEngineerExpense(() => {
      setIsAddExpenseOpen(true)
    })
  }, [expenseShortcuts, engineerData?.showAll])

  function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId)
    try {
      localStorage.setItem(ENGINEER_PROJECT_STORAGE_KEY, projectId)
    } catch {
      // ignore storage errors
    }
  }

  async function handleSubmitExpense() {
    const project = engineerData?.activeProject
    if (!project) return

    const amount = parseFloat(expenseForm.amount)
    if (!expenseForm.category || !expenseForm.description?.trim()) {
      toast.error("Category and description are required.")
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount greater than zero.")
      return
    }

    setIsSubmittingExpense(true)
    const result = await createExpenseAction({
      projectId: project.id,
      milestoneId: expenseForm.milestoneId || null,
      category: expenseForm.category,
      description: expenseForm.description.trim(),
      amount,
      vendorName: expenseForm.vendor?.trim() || null,
      billNumber: null,
      expenseDate: format(new Date(), "yyyy-MM-dd"),
      status: "pending",
    })
    setIsSubmittingExpense(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Expense submitted for approval.")
    setIsAddExpenseOpen(false)
    setExpenseForm({
      category: "",
      description: "",
      amount: "",
      vendor: "",
      milestoneId: "",
    })
    void mutate()
  }

  if (isLoading) {
    return (
      <PageShell>
        <DashboardHeader />
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading site data...</p>
          </div>
        </div>
      </PageShell>
    )
  }

  if (error || !assignedProjects.length || !engineerData) {
    const message =
      error instanceof Error ? error.message : NO_ASSIGNED_PROJECT_MESSAGE
    return (
      <PageShell>
        <DashboardHeader />
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <p className="text-muted-foreground">{message}</p>
          {error && (
            <Button variant="outline" onClick={() => void mutate()}>
              Try again
            </Button>
          )}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <DashboardHeader />

      <PageMain>
        <PageHeader
          title="Site Dashboard"
          description="Log site expenses and manpower — payments and budgets are managed by your PM."
        >
          {assignedProjects.length > 0 && (
            <Select value={effectiveProjectId} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-full sm:w-[220px] bg-secondary border-border">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {assignedProjects.length > 1 && (
                  <SelectItem value={SHOW_ALL_PROJECTS}>Show all</SelectItem>
                )}
                {assignedProjects.map((project, index) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name || `Project ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </PageHeader>

        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-foreground">{engineerData.projectName}</p>
              <p className="text-muted-foreground">{engineerData.siteAddress}</p>
            </div>
            {engineerData.idle.label !== "—" ? (
              <ProjectIdleBadge idle={engineerData.idle} />
            ) : null}
          </div>
          {engineerData.idle.isIdle ? (
            <p className="mt-2 text-xs text-muted-foreground">{engineerData.idle.detail}</p>
          ) : null}
        </div>

        {/* Current Stage - Compact Inline Display */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current Stage:</span>
              <Badge variant="default" className="font-semibold">
                {engineerData.showAll
                  ? "Varies by site"
                  : engineerData.currentMilestone?.name ?? "No active stage"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick Stats - NO budget/profit info for engineer */}
        <div className={STATS_GRID_CLASS}>
          <MetricCard
            title="Today's Expenses"
            value={formatINR(engineerData.totalTodayExpenses)}
            description={`${engineerData.todayExpenses.length} entries`}
            icon={Receipt}
          />
          <MetricCard
            title="Labour Today"
            value={engineerData.labourCount}
            description="Workers on site"
            icon={Users}
          />
          <MetricCard
            title="Active Vendors"
            value={engineerData.activeVendors}
            description="Unique vendors"
            icon={Truck}
          />
          <MetricCard
            title="Pending Approvals"
            value={engineerData.pendingCount}
            description="Awaiting PM approval"
            icon={Clock}
            variant={engineerData.pendingCount > 0 ? "warning" : "default"}
            className={cn(engineerData.pendingCount > 0 && "border-yellow-500/30")}
            valueClassName={engineerData.pendingCount > 0 ? "text-yellow-500" : undefined}
          />
        </div>

        {/* Main Content Grid */}
        <div className={CONTENT_SIDEBAR_GRID_CLASS}>
          <div className={cn(CONTENT_SIDEBAR_MAIN_CLASS, "space-y-6")}>
            {/* Expenses Tabs */}
            <Tabs defaultValue="today" className="w-full">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="today">Recent Expenses</TabsTrigger>
                  <TabsTrigger value="history" className="gap-2">
                    <History className="h-4 w-4" />
                    All Expenses
                  </TabsTrigger>
                </TabsList>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    variant="outline"
                    className="w-full gap-2 sm:w-auto"
                    disabled={engineerData.showAll}
                    title={
                      engineerData.showAll
                        ? "Select a single project for bulk entry"
                        : undefined
                    }
                    onClick={() => setIsBulkEntryOpen(true)}
                  >
                    Bulk entry
                  </Button>
                  <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full gap-2 sm:w-auto"
                        disabled={engineerData.showAll}
                        title={
                          engineerData.showAll
                            ? "Select a single project to add an expense"
                            : "Add expense (Ctrl+E)"
                        }
                      >
                        <Plus className="h-4 w-4" />
                        Add Expense
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="flex max-h-[min(92dvh,100dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[500px]">
                    <MandatoryExpenseKeyboardProvider
                      enabled={isAddExpenseOpen}
                      fields={engineerMandatoryFields}
                      onSubmit={() => void handleSubmitExpense()}
                      autoAdvanceSelectOnLetter
                    >
                      <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
                        <DialogTitle>Add New Expense</DialogTitle>
                        <DialogDescription>
                          Record a new expense for approval
                        </DialogDescription>
                      </DialogHeader>
                      <EngineerAddExpenseForm
                        expenseForm={expenseForm}
                        setExpenseForm={setExpenseForm}
                        milestones={engineerData.milestones}
                      />
                      <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-6">
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => setIsAddExpenseOpen(false)}
                          disabled={isSubmittingExpense}
                        >
                          Cancel
                        </Button>
                        <MandatoryExpenseSubmitButton
                          className="w-full sm:w-auto"
                          onClick={() => void handleSubmitExpense()}
                          disabled={isSubmittingExpense}
                        >
                          {isSubmittingExpense ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Submitting…
                            </>
                          ) : (
                            "Submit for Approval"
                          )}
                        </MandatoryExpenseSubmitButton>
                      </DialogFooter>
                    </MandatoryExpenseKeyboardProvider>
                  </DialogContent>
                </Dialog>
                {engineerData.activeProject ? (
                  <ExpenseBulkEntryDialog
                    variant="engineer"
                    open={isBulkEntryOpen}
                    onOpenChange={setIsBulkEntryOpen}
                    projectId={engineerData.activeProject.id}
                    milestones={engineerData.milestones}
                    onSaved={() => void mutate()}
                  />
                ) : null}
                </div>
              </div>

              <TabsContent value="today">
                <Card>
                  <CardContent className="pt-6">
                    {engineerData.todayExpenses.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">No expenses recorded today</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            {engineerData.showAll && <TableHead>Project</TableHead>}
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {engineerData.todayExpenses.map((expense) => (
                            <TableRow
                              key={`${expense.projectName ?? "single"}-${expense.id}`}
                              className="border-border"
                            >
                              {engineerData.showAll && (
                                <TableCell className="text-muted-foreground">
                                  {expense.projectName}
                                </TableCell>
                              )}
                              <TableCell>
                                <Badge variant="outline">{expense.category}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{expense.description}</TableCell>
                              <TableCell className="text-muted-foreground">{expense.vendor}</TableCell>
                              <TableCell className="text-right">{formatINR(expense.amount)}</TableCell>
                              <TableCell className="text-right">
                                {expense.status === "approved" ? (
                                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Approved
                                  </Badge>
                                ) : (
                                  <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pending
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead>Date</TableHead>
                          {engineerData.showAll && <TableHead>Project</TableHead>}
                          <TableHead>Category</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {engineerData.allExpenses.map((expense) => (
                          <TableRow
                            key={`${expense.projectName ?? "single"}-${expense.id}`}
                            className="border-border"
                          >
                            <TableCell className="text-muted-foreground">
                              {expense.time
                                ? format(parseExpenseDate(expense.time), "dd MMM")
                                : "—"}
                            </TableCell>
                            {engineerData.showAll && (
                              <TableCell className="text-muted-foreground">
                                {expense.projectName}
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge variant="outline">{expense.category}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{expense.description}</TableCell>
                            <TableCell className="text-right">{formatINR(expense.amount)}</TableCell>
                            <TableCell className="text-right">
                              {expense.status === "approved" ? (
                                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                  Approved
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="min-w-0 space-y-6">
            {engineerData.showAll ? (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  Select a single project to open site tools, milestones, and manpower for that site.
                </CardContent>
              </Card>
            ) : (
              <>
            {engineerData.activeProject && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Site tools</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/projects/${engineerData.activeProject.id}?tab=expenses`}>
                      <Receipt className="h-4 w-4 mr-2" />
                      All expenses &amp; bills
                    </Link>
                  </Button>
                  {canUseManpower && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <Link href={`/projects/${engineerData.activeProject.id}?tab=manpower`}>
                        <Users className="h-4 w-4 mr-2" />
                        Manpower log
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/projects/${engineerData.activeProject.id}?tab=milestones`}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Milestones (view only)
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Milestones Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Milestone Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {engineerData.milestones.map((ms) => (
                    <div key={ms.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center",
                        ms.status === 'completed' ? "bg-green-500/20 text-green-500" :
                        ms.status === 'in-progress' ? "bg-primary/20 text-primary" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {ms.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{ms.name}</p>
                      </div>
                      <Badge variant={
                        ms.status === 'completed' ? 'default' :
                        ms.status === 'in-progress' ? 'secondary' : 'outline'
                      } className="text-xs">
                        {ms.status === 'completed' ? 'Done' : 
                         ms.status === 'in-progress' ? 'Active' : 'Pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
              </>
            )}
          </div>
        </div>
      </PageMain>
    </PageShell>
  )
}
