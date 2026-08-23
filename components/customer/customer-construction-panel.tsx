"use client"

import { useMemo, useEffect, useState } from "react"
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  HardHat,
  Image as ImageIcon,
  IndianRupee,
  MapPin,
  Phone,
  TrendingUp,
} from "lucide-react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatINR } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { ProjectWithDetails } from "@/lib/types/database"
import {
  useProjectMetrics,
  useCustomerMilestones,
} from "@/lib/hooks/use-project-data"
import { shouldUseLiveFinancials } from "@/lib/projects/lifecycle"
import { SitePhotosGallery } from "@/components/projects/project-detail/site-photos-gallery"
import { CustomerChangeRequestsPanel } from "@/components/customer/customer-change-requests-panel"
import { CONSTRUCTION_PREVIEW_PAYMENTS } from "@/lib/projects/construction-preview"
import {
  calculateCompletionPercent,
  type MilestoneData,
} from "@/lib/financial-calculations"
import { getProjectPmLabel, getProjectEngineersLabel } from "@/lib/staff-labels"

interface CustomerConstructionPanelProps {
  project: ProjectWithDetails
  initialTab?: "milestones" | "upcoming" | "photos" | "changes"
  selectedRequestId?: string
}

export function CustomerConstructionPanel({
  project,
  initialTab,
  selectedRequestId,
}: CustomerConstructionPanelProps) {
  const [activeTab, setActiveTab] = useState<"milestones" | "upcoming" | "photos" | "changes">(
    initialTab ?? "milestones",
  )

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])
  const metrics = useProjectMetrics(project)
  const displayMilestones = useCustomerMilestones(project)
  const isPreview = !shouldUseLiveFinancials(project)

  const data = useMemo(() => {
    if (isPreview) {
      return {
        name: project.name,
        siteAddress: project.site_address,
        currentStage: "Design phase",
        expectedEndDate: project.expected_completion_date
          ? new Date(project.expected_completion_date)
          : new Date(),
        projectManager: getProjectPmLabel(project),
        siteEngineers: getProjectEngineersLabel(project),
        contractValue: 0,
        totalPaid: 0,
        pendingAmount: 0,
        progress: 0,
        nextPayment: null as null,
        paymentHistory: [] as Array<{
          id: string
          stage: string
          amount: number
          date: Date
          receiptNo: string
        }>,
        upcomingPayments: CONSTRUCTION_PREVIEW_PAYMENTS.map((p, idx) => ({
          id: `preview-${idx}`,
          stage: p.stage,
          amount: p.amount,
          dueDate: new Date(),
          status: p.status,
        })),
        milestones: displayMilestones,
      }
    }

    const milestonesForCalc: MilestoneData[] = project.milestones.map((ms) => ({
      name: ms.name,
      expectedCostPercent: Number(ms.expected_cost_percent),
      actualCompletionPercent: ms.actual_completion_percent,
      targetBudget: Number(ms.target_budget),
      actualExpenses: Number(ms.actual_expenses),
      status: ms.status,
    }))

    const progress = calculateCompletionPercent(milestonesForCalc)
    const currentMilestone = project.milestones.find((ms) => ms.status === "in-progress")
    const contractValue = metrics.totalContractValue
    const totalPaid = metrics.totalClientPaymentsReceived
    const pendingAmount = Math.max(0, contractValue - totalPaid)

    const paymentHistory = project.client_payments
      .filter((cp) => cp.status === "received")
      .map((cp, idx) => ({
        id: cp.id,
        stage: cp.stage_name,
        amount: Number(cp.amount),
        date: cp.received_date ? new Date(cp.received_date) : new Date(),
        receiptNo: `RCP-${(idx + 1).toString().padStart(3, "0")}`,
      }))

    const upcomingPayments = project.client_payments
      .filter((cp) => cp.status === "pending" || cp.status === "overdue")
      .map((cp) => {
        const dueDate = cp.due_date ? new Date(cp.due_date) : new Date()
        const isOverdue = cp.status === "overdue" || dueDate < new Date()
        return {
          id: cp.id,
          stage: cp.stage_name,
          amount: Number(cp.amount),
          dueDate,
          status: isOverdue ? ("overdue" as const) : ("upcoming" as const),
        }
      })

    const nextPayment = upcomingPayments.length > 0 ? upcomingPayments[0] : null

    return {
      name: project.name,
      siteAddress: project.site_address,
      currentStage: currentMilestone?.name || "Foundation",
      expectedEndDate: project.expected_completion_date
        ? new Date(project.expected_completion_date)
        : new Date(),
      projectManager: getProjectPmLabel(project),
      siteEngineers: getProjectEngineersLabel(project),
      contractValue,
      totalPaid,
      pendingAmount,
      progress: Math.round(progress),
      nextPayment,
      paymentHistory,
      upcomingPayments,
      milestones: displayMilestones,
    }
  }, [project, metrics, isPreview, displayMilestones])

  return (
    <div className="space-y-6">
      {isPreview && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Construction tracking starts after your project manager activates this phase. Below
          is a preview of what you will see.
        </div>
      )}

      <Card className="section-card">
        <CardHeader>
          <CardTitle>{data.name}</CardTitle>
          <CardDescription>
            {isPreview ? "Construction preview" : "Track your project payments and progress"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Site Address</p>
              </div>
              <p className="text-sm font-medium">{data.siteAddress}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Current Stage</p>
              </div>
              <p className="text-sm font-medium">{data.currentStage}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Expected Completion</p>
              </div>
              <p className="text-sm font-medium">
                {format(data.expectedEndDate, "dd MMM yyyy")}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Project Manager</p>
              </div>
              <p
                className={cn(
                  "text-sm font-medium",
                  data.projectManager.includes("not created") && "italic text-muted-foreground",
                )}
              >
                {data.projectManager}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <HardHat className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Site Engineer</p>
              </div>
              <p
                className={cn(
                  "text-sm font-medium",
                  data.siteEngineers.includes("not created") && "italic text-muted-foreground",
                )}
              >
                {data.siteEngineers}
              </p>
            </div>
          </div>

          {!isPreview && (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Total Contract Value</p>
                  <p className="text-xl font-bold">{formatINR(data.contractValue)}</p>
                </div>
                <div className="rounded-lg bg-green-500/10 p-4">
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-xl font-bold text-green-500">{formatINR(data.totalPaid)}</p>
                </div>
                <div className="rounded-lg bg-yellow-500/10 p-4">
                  <p className="text-sm text-muted-foreground">Balance Pending</p>
                  <p className="text-xl font-bold text-yellow-500">
                    {formatINR(data.pendingAmount)}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Project Progress</span>
                  <span className="text-sm text-muted-foreground">{data.progress}%</span>
                </div>
                <Progress value={data.progress} className="h-3" />
              </div>

              {data.nextPayment && (
                <Card className="mb-6 border-primary/50 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                          <IndianRupee className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Next Payment Due</p>
                          <p className="text-xl font-bold">
                            {formatINR(data.nextPayment.amount)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Stage: {data.nextPayment.stage}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Due: {format(data.nextPayment.dueDate, "dd MMM yyyy")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {isPreview && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium">Project Progress (preview)</p>
              <Progress value={0} className="h-3" />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="upcoming">Payments</TabsTrigger>
              <TabsTrigger value="photos">Site Photos</TabsTrigger>
              <TabsTrigger value="changes">Change requests</TabsTrigger>
            </TabsList>

            <TabsContent value="milestones" className="mt-4">
              <div className="space-y-4">
                {data.milestones.map((milestone, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 rounded-lg bg-muted/50 p-4"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        milestone.status === "completed"
                          ? "bg-green-500/20 text-green-500"
                          : milestone.status === "in-progress"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {milestone.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : milestone.status === "in-progress" ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{milestone.name}</p>
                    </div>
                    <Badge
                      variant={
                        milestone.status === "completed"
                          ? "default"
                          : milestone.status === "in-progress"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {milestone.status === "completed"
                        ? "Completed"
                        : milestone.status === "in-progress"
                          ? "In Progress"
                          : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="upcoming" className="mt-4">
              {isPreview ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Payment schedule will appear when construction begins.
                </p>
              ) : (
                <Tabs defaultValue="upcoming-inner" className="w-full">
                  <TabsList>
                    <TabsTrigger value="upcoming-inner">Upcoming</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upcoming-inner">
                    {data.upcomingPayments.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">
                        No upcoming payments
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stage</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Due Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.upcomingPayments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>{payment.stage}</TableCell>
                              <TableCell className="text-right">
                                {formatINR(payment.amount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {format(payment.dueDate, "dd MMM yyyy")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                  <TabsContent value="history">
                    {data.paymentHistory.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">No payment history</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stage</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.paymentHistory.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>{payment.stage}</TableCell>
                              <TableCell className="text-right text-green-500">
                                {formatINR(payment.amount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {format(payment.date, "dd MMM yyyy")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              {isPreview ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Site photos will appear here when construction begins.
                </p>
              ) : (
                <SitePhotosGallery projectId={project.id} customerMode />
              )}
            </TabsContent>

            <TabsContent value="changes" className="mt-4">
              {isPreview ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Change requests will be available once construction begins.
                </p>
              ) : (
                <CustomerChangeRequestsPanel
                  project={project}
                  selectedRequestId={selectedRequestId}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
