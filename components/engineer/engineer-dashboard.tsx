"use client"

import { useState, useMemo, useEffect, useRef } from "react"
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
import { useProjectDetailsList, useLabourTypes } from "@/lib/hooks/use-project-data"
import type { ProjectWithDetails } from "@/lib/types/database"
import { NO_ASSIGNED_PROJECT_MESSAGE } from "@/lib/project-access"
import { createExpenseAction } from "@/lib/projects/tab-actions"
import { toast } from "sonner"
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

function parseExpenseDate(value: string): Date {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseISO(trimmed)
  }
  return new Date(trimmed)
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
}

function mapExpenseRow(
  exp: ProjectWithDetails["expenses"][number],
  projectName?: string,
): EngineerExpenseRow {
  return {
    id: exp.id,
    time: exp.expense_date,
    category: exp.category,
    description: exp.description,
    vendor: exp.vendor_name || "N/A",
    amount: Number(exp.amount),
    status: exp.status,
    projectName,
  }
}

function buildViewFromProject(project: ProjectWithDetails): EngineerDashboardView {
  const today = new Date()
  const currentMilestone =
    project.milestones.find((ms) => ms.status === "in-progress") ?? null
  const milestones = project.milestones.map((ms) => ({
    id: ms.id,
    name: ms.name,
    status: ms.status,
  }))

  const todayExpenses = project.expenses
    .filter((exp) => isSameDay(parseExpenseDate(exp.expense_date), today))
    .sort(
      (a, b) =>
        parseExpenseDate(b.expense_date).getTime() -
        parseExpenseDate(a.expense_date).getTime(),
    )
    .map((exp) => mapExpenseRow(exp))

  const allExpenses = [...project.expenses]
    .sort(
      (a, b) =>
        parseExpenseDate(b.expense_date).getTime() -
        parseExpenseDate(a.expense_date).getTime(),
    )
    .map((exp) => mapExpenseRow(exp))

  const pendingCount = project.expenses.filter((exp) => exp.status === "pending").length
  const activeVendors = new Set(
    todayExpenses.map((exp) => exp.vendor).filter((name) => name !== "N/A"),
  ).size

  return {
    showAll: false,
    activeProject: project,
    projectName: project.name,
    siteAddress: project.site_address,
    currentMilestone,
    milestones,
    todayExpenses,
    allExpenses,
    totalTodayExpenses: todayExpenses.reduce((sum, exp) => sum + exp.amount, 0),
    pendingCount,
    labourCount: project.labour_workers_today ?? 0,
    activeVendors,
  }
}

function buildViewFromAllProjects(projects: ProjectWithDetails[]): EngineerDashboardView {
  const today = new Date()
  const todayExpenses = projects
    .flatMap((project) =>
      project.expenses
        .filter((exp) => isSameDay(parseExpenseDate(exp.expense_date), today))
        .map((exp) => mapExpenseRow(exp, project.name)),
    )
    .sort(
      (a, b) =>
        parseExpenseDate(b.expense_date).getTime() -
        parseExpenseDate(a.expense_date).getTime(),
    )

  const allExpenses = projects
    .flatMap((project) =>
      project.expenses.map((exp) => mapExpenseRow(exp, project.name)),
    )
    .sort(
      (a, b) =>
        parseExpenseDate(b.expense_date).getTime() -
        parseExpenseDate(a.expense_date).getTime(),
    )

  const pendingCount = projects.reduce(
    (sum, project) =>
      sum + project.expenses.filter((exp) => exp.status === "pending").length,
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
  }
}

export function EngineerDashboard() {
  const { projects: assignedProjects, isLoading, error, mutate } = useProjectDetailsList()
  const { labourTypes } = useLabourTypes()
  const [selectedProjectId, setSelectedProjectId] = useState(SHOW_ALL_PROJECTS)
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    description: '',
    amount: '',
    vendor: '',
    milestoneId: ''
  })

  const hasInitializedProject = useRef(false)

  useEffect(() => {
    if (!assignedProjects.length || hasInitializedProject.current) return
    hasInitializedProject.current = true

    if (assignedProjects.length === 1) {
      setSelectedProjectId(assignedProjects[0].id)
      return
    }

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
  }, [assignedProjects])

  const engineerData = useMemo((): EngineerDashboardView | null => {
    if (!assignedProjects.length) return null

    if (selectedProjectId === SHOW_ALL_PROJECTS) {
      return buildViewFromAllProjects(assignedProjects)
    }

    const project = assignedProjects.find((p) => p.id === selectedProjectId)
    if (!project) {
      return buildViewFromAllProjects(assignedProjects)
    }

    return buildViewFromProject(project)
  }, [assignedProjects, selectedProjectId])

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
    if (!expenseForm.category || !expenseForm.description.trim()) {
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
      vendorName: expenseForm.vendor.trim() || null,
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
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-2 px-6 py-24 text-center">
          <p className="text-muted-foreground">{message}</p>
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
          description={format(new Date(), "EEEE, dd MMMM yyyy")}
        >
          <Select value={selectedProjectId} onValueChange={handleProjectChange}>
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
        </PageHeader>

        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          <p className="font-medium text-foreground">{engineerData.projectName}</p>
          <p className="text-muted-foreground">{engineerData.siteAddress}</p>
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
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="today">Recent Expenses</TabsTrigger>
                  <TabsTrigger value="history" className="gap-2">
                    <History className="h-4 w-4" />
                    All Expenses
                  </TabsTrigger>
                </TabsList>
                <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="gap-2"
                      disabled={engineerData.showAll}
                      title={
                        engineerData.showAll
                          ? "Select a single project to add an expense"
                          : undefined
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Add New Expense</DialogTitle>
                      <DialogDescription>
                        Record a new expense for approval
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Stage</Label>
                        <Select 
                          value={expenseForm.milestoneId}
                          onValueChange={(v) => setExpenseForm({...expenseForm, milestoneId: v})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {engineerData.milestones.map((ms) => (
                              <SelectItem key={ms.id} value={ms.id}>
                                {ms.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select 
                          value={expenseForm.category}
                          onValueChange={(v) => setExpenseForm({...expenseForm, category: v})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Materials">Materials</SelectItem>
                            <SelectItem value="Labour">Labour</SelectItem>
                            <SelectItem value="Equipment">Equipment</SelectItem>
                            <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input 
                          value={expenseForm.description}
                          onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                          placeholder="e.g., Cement - 50 bags" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Vendor Name</Label>
                        <Input 
                          value={expenseForm.vendor}
                          onChange={(e) => setExpenseForm({...expenseForm, vendor: e.target.value})}
                          placeholder="Vendor name" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount (₹)</Label>
                        <Input 
                          type="number"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                          placeholder="0" 
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsAddExpenseOpen(false)}
                        disabled={isSubmittingExpense}
                      >
                        Cancel
                      </Button>
                      <Button
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
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                              {format(parseExpenseDate(expense.time), "dd MMM")}
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
                  Select a single project to view labour types and milestone progress for that site.
                </CardContent>
              </Card>
            ) : (
              <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Labour Types</CardTitle>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {labourTypes.map((type) => (
                    <div key={type.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{type.name}</p>
                        <p className="text-xs text-muted-foreground">Default: {formatINR(Number(type.default_wage))}/day</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
