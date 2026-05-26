"use client"

import { useState, useMemo, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Camera,
  Users,
  Edit,
  MoreVertical,
  Loader2
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
import { ManpowerTab } from "./project-detail/manpower-tab"
import { useProject, useDefaultProject, useProjectMetrics } from "@/lib/hooks/use-project-data"
import { getProjectPmLabel, getProjectEngineersLabel } from "@/lib/staff-labels"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  canEnterManpowerData,
  canViewProjectFinancials,
  ENGINEER_RESTRICTED_PROJECT_TABS,
} from "@/lib/permissions"

interface ProjectDetailContentProps {
  projectId: string
}

export function ProjectDetailContent({ projectId }: ProjectDetailContentProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const { role, canManageProjects } = useAuth()
  const showFinancials = canViewProjectFinancials(role)
  const canEditManpower = canEnterManpowerData(role)
  
  // Use default project if projectId is "1" or use specific project
  const isLegacyDefaultId = projectId === "1"
  const {
    project: specificProject,
    isLoading: specificLoading,
    mutate: mutateProject,
  } = useProject(isLegacyDefaultId ? null : projectId)
  const {
    project: defaultProject,
    isLoading: defaultLoading,
    mutate: mutateDefaultProject,
  } = useDefaultProject(isLegacyDefaultId)

  const project = isLegacyDefaultId ? defaultProject : specificProject
  const isLoading = isLegacyDefaultId ? defaultLoading : specificLoading
  const refreshProject = () => {
    if (isLegacyDefaultId) {
      void mutateDefaultProject()
    } else {
      void mutateProject()
    }
  }
  
  const metrics = useProjectMetrics(project)

  // Calculate all derived values for OverviewTab
  const calculatedData = useMemo(() => {
    if (!project) return null
    
    // Additional works approved
    const additionalWorksApproved = project.additional_works
      .filter(aw => aw.approval_status === "approved")
      .reduce((sum, aw) => sum + Number(aw.amount), 0)
    
    // Total approved expenses
    const totalExpenses = project.expenses
      .filter(exp => exp.status === "approved")
      .reduce((sum, exp) => sum + Number(exp.amount), 0)
    
    // Client payments received
    const totalClientPaymentsReceived = project.client_payments
      .filter(cp => cp.status === "received")
      .reduce((sum, cp) => sum + Number(cp.amount), 0)

    // Vendor payments pending - using the actual pending_amount
    const totalVendorPaymentsPending = project.vendor_payments
      .reduce((sum, vp) => sum + Number(vp.pending_amount), 0)

    // Transform milestones for OverviewTab
    const milestones = project.milestones.map(ms => ({
      id: ms.id,
      name: ms.name,
      expectedCostPercent: Number(ms.expected_cost_percent),
      actualCompletionPercent: Number(ms.actual_completion_percent),
      status: ms.status,
      targetBudget: Number(ms.target_budget),
      actualExpenses: Number(ms.actual_expenses)
    }))

    // Create attention items from the data
    const unpaidVendorBills = project.vendor_payments
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

    const delayedClientPayments = project.client_payments
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

    // Pending expense approvals
    const pendingApprovals = project.expenses
      .filter(exp => exp.status === 'pending')
      .map(exp => ({
        type: 'Expense',
        description: exp.description,
        amount: Number(exp.amount),
        requestedBy: 'Site Engineer',
        date: exp.expense_date
      }))

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
    }
  }, [project])

  const tabs = useMemo(
    () =>
      [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "expenses", label: "Expenses", icon: Receipt },
        { id: "payments", label: "Payments", icon: CreditCard },
        { id: "milestones", label: "Milestones", icon: Flag },
        { id: "manpower", label: "Manpower", icon: Users },
        { id: "additional-works", label: "Additional Works", icon: PlusCircle },
        { id: "reports", label: "Reports", icon: FileBarChart },
        { id: "photos", label: "Photos", icon: Camera },
      ].filter((tab) => showFinancials || !ENGINEER_RESTRICTED_PROJECT_TABS.has(tab.id)),
    [showFinancials],
  )

  useEffect(() => {
    if (!showFinancials && ENGINEER_RESTRICTED_PROJECT_TABS.has(activeTab)) {
      setActiveTab("overview")
    }
  }, [showFinancials, activeTab])

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
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <main className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading project data...</p>
        </div>
      </main>
    )
  }

  if (!project || !calculatedData) {
    return (
      <main className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Back to Projects</span>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Project not found</p>
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Back to Projects</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {project.name}
              </h1>
              {getStatusBadge(project.status)}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              <span>Client: {project.client_name}</span>
              <span>|</span>
              <span>{project.site_address}</span>
              <span>|</span>
              <span>PM: {getProjectPmLabel(project)}</span>
              <span>|</span>
              <span>Site Engineer: {getProjectEngineersLabel(project)}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            {canManageProjects && (
              <>
                <Button variant="outline" className="gap-2" asChild>
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
                    <DropdownMenuItem className="text-destructive">Archive Project</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 border border-border p-1 h-auto flex-wrap gap-1">
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.id}
              value={tab.id}
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab projectData={calculatedData} restrictFinancials={!showFinancials} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <ExpensesTab
            projectId={project.id}
            project={project}
            onProjectChange={refreshProject}
          />
        </TabsContent>

        {showFinancials && (
          <TabsContent value="payments" className="mt-6">
            <PaymentsTab
              projectId={project.id}
              project={project}
              onProjectChange={refreshProject}
            />
          </TabsContent>
        )}

        <TabsContent value="milestones" className="mt-6">
          <MilestonesTab
            projectId={project.id}
            project={project}
            onProjectChange={refreshProject}
          />
        </TabsContent>

        <TabsContent value="manpower" className="mt-6">
          <ManpowerTab
            projectId={project.id}
            projectStartDate={project.start_date}
            projectMilestones={project.milestones.map((m) => ({
              id: m.id,
              name: m.name,
            }))}
            readOnly={!canEditManpower}
          />
        </TabsContent>

        {showFinancials && (
          <TabsContent value="additional-works" className="mt-6">
            <AdditionalWorksTab
              projectId={project.id}
              project={project}
              onProjectChange={refreshProject}
            />
          </TabsContent>
        )}

        {showFinancials && (
          <TabsContent value="reports" className="mt-6">
            <ReportsTab projectId={project.id} project={project} />
          </TabsContent>
        )}

        <TabsContent value="photos" className="mt-6">
          <PhotosTab projectId={project.id} projectName={project.name} />
        </TabsContent>
      </Tabs>
    </main>
  )
}
