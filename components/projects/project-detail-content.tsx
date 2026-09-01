"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Receipt, 
  CreditCard, 
  Flag, 
  PlusCircle, 
  FileBarChart, 
  FileText,
  Camera,
  ClipboardCheck,
  PenLine,
  Users,
  Edit,
  MoreVertical,
  Loader2,
  AlertCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { OverviewTab } from "./project-detail/overview-tab"
import { ExpensesTab } from "./project-detail/expenses-tab"
import { PaymentsTab } from "./project-detail/payments-tab"
import { MilestonesTab } from "./project-detail/milestones-tab"
import { AdditionalWorksTab } from "./project-detail/additional-works-tab"
import { ReportsTab } from "./project-detail/reports-tab"
import { PhotosTab } from "./project-detail/photos-tab"
import { ProjectQualityTab } from "@/components/quality/project-quality-tab"
import { DesignTab } from "./project-detail/design-tab"
import { ProjectProposalsTab } from "./project-detail/proposals-tab"
import { isConstructionActive } from "@/lib/projects/lifecycle"
import { ManpowerTab } from "./project-detail/manpower-tab"
import {
  ProjectSidebar,
  ProjectSidebarMobileTrigger,
  type ProjectSidebarTab,
} from "./project-detail/project-sidebar"
import { useProject, useDefaultProject, useProjectMetrics } from "@/lib/hooks/use-project-data"
import { projectIdleFromProject } from "@/lib/project-idle"
import { ProjectIdleBadge } from "@/components/projects/project-idle-badge"
import { getApprovedAdditionalWorksTotal } from "@/lib/financial-calculations"
import {
  getProjectPmLabel,
  getProjectEngineersLabel,
  getProjectClientDisplayName,
} from "@/lib/staff-labels"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  canEnterManpowerData,
  canViewProjectFinancials,
  canAccessProjectTab,
  canUserUploadSitePhotosOnProject,
  isCustomerRole,
  CUSTOMER_ALLOWED_PROJECT_TABS,
} from "@/lib/permissions"
import { isDatabaseSetupError } from "@/lib/supabase/db-errors"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PAGE_MAIN_CLASS,
  PAGE_STACK_CLASS,
} from "@/components/layout/page"
import { cn } from "@/lib/utils"
import { archiveProjectAction } from "@/lib/projects/actions"
import { toast } from "sonner"
import { ProjectDetailLoading } from "@/components/projects/project-detail-loading"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface ProjectDetailContentProps {
  projectId: string
}

const PROJECT_TAB_IDS = [
  "design",
  "overview",
  "proposals",
  "expenses",
  "payments",
  "milestones",
  "manpower",
  "additional-works",
  "reports",
  "photos",
  "quality",
] as const

const RECENT_EXPENSE_ACTION_MS = 3 * 24 * 60 * 60 * 1000

function shouldShowExpenseInOverview(exp: { status: string; updated_at: string }) {
  if (exp.status === "pending") return true
  if (exp.status !== "approved" && exp.status !== "rejected") return false
  return Date.now() - new Date(exp.updated_at).getTime() <= RECENT_EXPENSE_ACTION_MS
}

export function ProjectDetailContent({ projectId }: ProjectDetailContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState("overview")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const { role, user, canManageProjects } = useAuth()
  const isCustomer = isCustomerRole(role)
  const showFinancials = canViewProjectFinancials(role)
  const canEditManpower = canEnterManpowerData(role)
  
  // Use default project if projectId is "1" or use specific project
  const isLegacyDefaultId = projectId === "1"
  const {
    project: specificProject,
    isLoading: specificLoading,
    error: specificError,
    mutate: mutateProject,
  } = useProject(isLegacyDefaultId ? null : projectId)
  const {
    project: defaultProject,
    isLoading: defaultLoading,
    error: defaultError,
    mutate: mutateDefaultProject,
  } = useDefaultProject(isLegacyDefaultId)

  const project = isLegacyDefaultId ? defaultProject : specificProject
  const isLoading = isLegacyDefaultId ? defaultLoading : specificLoading
  const loadError = isLegacyDefaultId ? defaultError : specificError
  const projectIdle = useMemo(() => {
    if (!project) return null
    return projectIdleFromProject({
      start_date: project.start_date,
      status: project.status,
      expenses: (project.expenses ?? []).map((exp) => ({
        expense_date: exp.expense_date,
      })),
    })
  }, [project])
  const refreshProject = () => {
    if (isLegacyDefaultId) {
      void mutateDefaultProject()
    } else {
      void mutateProject()
    }
  }
  
  const metrics = useProjectMetrics(project)

  const canUploadProjectPhotos = useMemo(() => {
    if (!project || isCustomer) return false
    return canUserUploadSitePhotosOnProject(role, user?.id, project)
  }, [project, role, user?.id, isCustomer])

  // Calculate all derived values for OverviewTab
  const calculatedData = useMemo(() => {
    if (!project) return null
    
    const expenses = project.expenses ?? []
    const clientPayments = project.client_payments ?? []
    const vendorPayments = project.vendor_payments ?? []
    const projectMilestones = project.milestones ?? []

    // Additional works approved
    const additionalWorksApproved = getApprovedAdditionalWorksTotal(
      project.additional_works,
      project.additional_works_value,
    )
    
    // Total approved expenses
    const totalExpenses = expenses
      .filter(exp => exp.status === "approved")
      .reduce((sum, exp) => sum + Number(exp.amount), 0)
    
    // Client payments received
    const totalClientPaymentsReceived = clientPayments
      .filter(cp => cp.status === "received")
      .reduce((sum, cp) => sum + Number(cp.amount), 0)

    // Vendor payments pending - using the actual pending_amount
    const totalVendorPaymentsPending = vendorPayments
      .reduce((sum, vp) => sum + Number(vp.pending_amount), 0)

    // Transform milestones for OverviewTab
    const milestones = projectMilestones.map(ms => ({
      id: ms.id,
      name: ms.name,
      expectedCostPercent: Number(ms.expected_cost_percent),
      actualCompletionPercent: Number(ms.actual_completion_percent),
      status: ms.status,
      targetBudget: Number(ms.target_budget),
      actualExpenses: Number(ms.actual_expenses)
    }))

    const recentActivity = [
      ...expenses
        .filter((exp) => exp.status === "approved")
        .map((exp) => ({
          id: `expense-${exp.id}`,
          type: "expense" as const,
          title: exp.category,
          subtitle: exp.description,
          amount: Number(exp.amount),
          date: exp.expense_date,
        })),
      ...clientPayments
        .filter((cp) => cp.status === "received")
        .map((cp) => ({
          id: `payment-${cp.id}`,
          type: "payment_received" as const,
          title: "Payment Received",
          subtitle: cp.stage_name || "Client payment",
          amount: Number(cp.amount),
          date: cp.received_date || cp.due_date || cp.created_at,
        })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)

    // Create attention items from the data
    const unpaidVendorBills = vendorPayments
      .filter(vp => vp.status === 'overdue' || (vp.status === 'pending' && vp.due_date))
      .map(vp => {
        const dueDate = vp.due_date ? new Date(vp.due_date) : new Date()
        const today = new Date()
        const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        return {
          vendorName: vp.vendor_name,
          amount: Number(vp.pending_amount),
          dueDate: vp.due_date || '',
          overdueDays
        }
      })
      .filter(vp => vp.amount > 0)

    const delayedClientPayments = clientPayments
      .filter(cp => cp.status === 'overdue' || (cp.status === 'pending' && cp.due_date))
      .map(cp => {
        const dueDate = cp.due_date ? new Date(cp.due_date) : new Date()
        const today = new Date()
        const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        return {
          milestone: cp.stage_name,
          amount: Number(cp.amount),
          dueDate: cp.due_date || '',
          overdueDays
        }
      })
      .filter(cp => cp.overdueDays > 0)

    const expenseApprovals = [...expenses]
      .filter(shouldShowExpenseInOverview)
      .sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1
        if (b.status === "pending" && a.status !== "pending") return 1
        const timeA =
          a.status === "pending"
            ? new Date(a.expense_date).getTime()
            : new Date(a.updated_at).getTime()
        const timeB =
          b.status === "pending"
            ? new Date(b.expense_date).getTime()
            : new Date(b.updated_at).getTime()
        return timeB - timeA
      })
      .map((exp) => ({
        id: exp.id,
        type: 'Expense',
        description: exp.description,
        category: exp.category,
        amount: Number(exp.amount),
        requestedBy: 'Site Engineer',
        date: exp.expense_date,
        status: exp.status as 'pending' | 'approved' | 'rejected',
      }))

    const pendingApprovals = expenseApprovals.filter((exp) => exp.status === 'pending')

    const expenseDates = expenses
      .filter((exp) => exp.status === "approved")
      .map((exp) => exp.expense_date)

    const paymentReceivedDates = clientPayments
      .filter((cp) => cp.status === "received")
      .map((cp) => cp.received_date || cp.due_date || cp.created_at)
      .filter(Boolean) as string[]

    return {
      originalContractValue: Number(project.contract_value),
      expectedProfitPercent: Number(project.expected_margin_percent),
      additionalWorksApproved,
      totalExpenses,
      totalClientPaymentsReceived,
      totalVendorPaymentsPending,
      milestones,
      unpaidVendorBills,
      delayedClientPayments,
      pendingApprovals,
      expenseApprovals,
      recentActivity,
      startDate: project.start_date,
      expectedCompletionDate: project.expected_completion_date,
      expenseDates,
      paymentReceivedDates,
      idleStatus: projectIdle,
    }
  }, [project, projectIdle])

  const tabs = useMemo<ProjectSidebarTab[]>(
    () =>
      [
        { id: "design", label: "Design", icon: PenLine },
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "proposals", label: "Proposals", icon: FileText },
        { id: "expenses", label: "Expenses", icon: Receipt },
        { id: "payments", label: "Payments", icon: CreditCard },
        { id: "milestones", label: "Milestones", icon: Flag },
        { id: "manpower", label: "Manpower", icon: Users },
        { id: "additional-works", label: "Additional Works", icon: PlusCircle },
        { id: "reports", label: "Reports", icon: FileBarChart },
        { id: "photos", label: "Photos", icon: Camera },
        { id: "quality", label: "Quality", icon: ClipboardCheck },
      ].filter((tab) => canAccessProjectTab(role, tab.id)),
    [role],
  )

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tabId)
    router.replace(`/projects/${projectId}?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (!tabParam || !PROJECT_TAB_IDS.includes(tabParam as (typeof PROJECT_TAB_IDS)[number])) {
      return
    }
    if (!canAccessProjectTab(role, tabParam)) {
      setActiveTab(isCustomer ? "design" : "overview")
      return
    }
    setActiveTab(tabParam)
  }, [searchParams, role, isCustomer])

  useEffect(() => {
    if (!canAccessProjectTab(role, activeTab)) {
      setActiveTab(isCustomer ? "design" : "overview")
    }
  }, [role, activeTab, isCustomer])

  useEffect(() => {
    if (isCustomer && !CUSTOMER_ALLOWED_PROJECT_TABS.has(activeTab)) {
      setActiveTab("design")
    }
  }, [isCustomer, activeTab])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Active</Badge>
      case "completed":
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Completed</Badge>
      case "on-hold":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">On Hold</Badge>
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "archived":
        return <Badge variant="outline" className="text-muted-foreground">Archived</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleArchiveProject = async () => {
    setIsArchiving(true)
    const result = await archiveProjectAction(projectId)
    setIsArchiving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Project archived.")
    setArchiveDialogOpen(false)
    router.push("/projects")
    router.refresh()
  }

  if (isLoading) {
    return <ProjectDetailLoading />
  }

  if (!project || !calculatedData) {
    const setupError =
      loadError instanceof Error && isDatabaseSetupError(loadError)
    const errorMessage =
      loadError instanceof Error ? loadError.message : null

    return (
      <main className={cn(PAGE_MAIN_CLASS, PAGE_STACK_CLASS)}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Back to Projects</span>
        </div>
        {errorMessage ? (
          <Card className="border-amber-500/30 bg-amber-500/5 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                {setupError ? "Database setup required" : "Could not load project"}
              </CardTitle>
              <CardDescription className="text-base text-foreground/80">
                {errorMessage}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => refreshProject()}>
                Try again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/projects">Back to Projects</Link>
              </Button>
            </CardContent>
            {setupError && (
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  If other tabs worked before Manpower was added, run{" "}
                  <code className="rounded bg-muted px-1">supabase/manpower-module.sql</code>{" "}
                  in the Supabase SQL Editor (paste the full file, then Run).
                </p>
                <p>
                  For a new database, run{" "}
                  <code className="rounded bg-muted px-1">schema.sql</code>, then{" "}
                  <code className="rounded bg-muted px-1">assignment-scoped-access.sql</code>, then{" "}
                  <code className="rounded bg-muted px-1">manpower-module.sql</code>, then{" "}
                  <code className="rounded bg-muted px-1">labour-teams-module.sql</code>, then{" "}
                  <code className="rounded bg-muted px-1">expense-categories-module.sql</code>.
                </p>
              </CardContent>
            )}
          </Card>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Project not found</p>
          </div>
        )}
      </main>
    )
  }

  const lifecyclePhase = project.lifecycle_phase ?? 'construction'
  const constructionActive = isConstructionActive({ lifecycle_phase: lifecyclePhase })

  const renderTabContent = () => {
    switch (activeTab) {
      case "design":
        return (
          <DesignTab
            projectId={project.id}
            projectName={project.name}
            lifecyclePhase={lifecyclePhase}
            canManageProjects={!!canManageProjects}
            onProjectChange={refreshProject}
          />
        )
      case "overview":
        return (
          <OverviewTab
            projectId={project.id}
            projectData={calculatedData}
            restrictFinancials={!showFinancials || isCustomer}
            canApproveExpenses={canManageProjects}
            onExpenseStatusChange={refreshProject}
          />
        )
      case "proposals":
        return <ProjectProposalsTab projectId={project.id} />
      case "expenses":
        return (
          <ExpensesTab
            projectId={project.id}
            project={project}
            onProjectChange={refreshProject}
          />
        )
      case "payments":
        return showFinancials ? (
          <PaymentsTab
            projectId={project.id}
            project={project}
            onProjectChange={refreshProject}
          />
        ) : null
      case "milestones":
        return (
          <MilestonesTab
            projectId={project.id}
            project={project}
            onProjectChange={refreshProject}
          />
        )
      case "manpower":
        return (
          <ManpowerTab
            projectId={project.id}
            projectStartDate={project.start_date}
            projectMilestones={(project.milestones ?? []).map((m) => ({
              id: m.id,
              name: m.name,
            }))}
            readOnly={!canEditManpower}
          />
        )
      case "additional-works":
        return showFinancials ? (
          <AdditionalWorksTab
            projectId={project.id}
            project={project}
            onProjectChange={refreshProject}
          />
        ) : null
      case "reports":
        return showFinancials ? (
          <ReportsTab projectId={project.id} project={project} />
        ) : null
      case "photos":
        return (
          <PhotosTab
            projectId={project.id}
            projectName={project.name}
            canUpload={canUploadProjectPhotos}
            customerMode={isCustomer}
          />
        )
      case "quality":
        return <ProjectQualityTab project={project} />
      default:
        return null
    }
  }

  return (
    <>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <ProjectSidebar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          projectId={project.id}
          canManageProjects={canManageProjects}
          className="hidden lg:flex"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border bg-background/95 px-4 py-4 md:px-6">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
              <div className="flex items-center gap-2">
                <ProjectSidebarMobileTrigger onClick={() => setSidebarOpen(true)} />
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/projects">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <span className="text-sm text-muted-foreground">Back to Projects</span>
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                      {project.name}
                    </h1>
                    {getStatusBadge(project.status)}
                    <Badge
                      variant={constructionActive ? "default" : "secondary"}
                      className={
                        constructionActive
                          ? "bg-green-500/20 text-green-600 border-green-500/30"
                          : "bg-amber-500/20 text-amber-700 border-amber-500/30"
                      }
                    >
                      {constructionActive ? "Construction" : "Design"}
                    </Badge>
                  </div>
                  {isCustomer && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      For payments and build progress, use{" "}
                      <Link href="/customer" className="font-medium text-primary hover:underline">
                        My Project dashboard
                      </Link>
                      . This page is for design drawings only.
                    </p>
                  )}
                  <dl className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="sr-only">Client</dt>
                      <dd>
                        <span className="text-foreground/70">Client: </span>
                        {getProjectClientDisplayName(project)}
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">PM</dt>
                      <dd>PM: {getProjectPmLabel(project)}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Site Engineer</dt>
                      <dd>Site Engineer: {getProjectEngineersLabel(project)}</dd>
                    </div>
                    <div className="sm:col-span-2 xl:col-span-1">
                      <dt className="sr-only">Site</dt>
                      <dd className="break-words">{project.site_address}</dd>
                    </div>
                    {projectIdle && (
                      <div>
                        <dt className="sr-only">Site activity</dt>
                        <dd className="flex flex-wrap items-center gap-2">
                          <span className="text-foreground/70">Site activity: </span>
                          <ProjectIdleBadge idle={projectIdle} />
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                  {canManageProjects && (
                    <>
                      <Button variant="outline" className="w-full gap-2 sm:w-auto" asChild>
                        <Link href={`/projects/${project.id}/edit`}>
                          <Edit className="h-4 w-4" />
                          Edit Project
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Export Project Data</DropdownMenuItem>
                          <DropdownMenuItem>Generate Report</DropdownMenuItem>
                          <DropdownMenuItem>Share Project</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            disabled={project.status === "archived"}
                            onClick={() => setArchiveDialogOpen(true)}
                          >
                            Archive Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 py-5 md:px-6">
            <div className="mx-auto w-full max-w-[1600px]">{renderTabContent()}</div>
          </div>
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[min(100vw-2rem,18rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Project navigation</SheetTitle>
          </SheetHeader>
          <ProjectSidebar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            projectId={project.id}
            canManageProjects={canManageProjects}
            className="h-full w-full border-0"
            onNavigate={() => setSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={archiveDialogOpen}
        onOpenChange={(open) => {
          if (!isArchiving) setArchiveDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive project?</AlertDialogTitle>
            <AlertDialogDescription>
              {project.name} will be hidden from the main project list. You can still find it
              under the Archived filter on Projects. Data is not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isArchiving}
              onClick={(event) => {
                event.preventDefault()
                void handleArchiveProject()
              }}
            >
              {isArchiving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Archiving…
                </>
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
