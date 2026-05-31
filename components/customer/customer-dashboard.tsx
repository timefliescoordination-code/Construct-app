"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { 
  IndianRupee, 
  Clock, 
  CheckCircle2, 
  Building2,
  Calendar,
  TrendingUp,
  Download,
  Phone,
  MapPin,
  Loader2,
  HardHat,
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useDefaultProject, useProjectMetrics } from "@/lib/hooks/use-project-data"
import { NO_ASSIGNED_PROJECT_MESSAGE } from "@/lib/project-access"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageHeader, PageMain, PageShell } from "@/components/layout/page"
import { getProjectPmLabel, getProjectEngineersLabel } from "@/lib/staff-labels"
import {
  calculateCompletionPercent,
  type MilestoneData
} from "@/lib/financial-calculations"

export function CustomerDashboard() {
  const { project, isLoading, error } = useDefaultProject()
  const metrics = useProjectMetrics(project)

  // Calculate customer-visible data
  const customerData = useMemo(() => {
    if (!project) return null

    const milestonesForCalc: MilestoneData[] = project.milestones.map(ms => ({
      name: ms.name,
      expectedCostPercent: Number(ms.expected_cost_percent),
      actualCompletionPercent: ms.actual_completion_percent,
      targetBudget: Number(ms.target_budget),
      actualExpenses: Number(ms.actual_expenses),
      status: ms.status
    }))

    const progress = calculateCompletionPercent(milestonesForCalc)
    const currentMilestone = project.milestones.find(ms => ms.status === 'in-progress')
    
    const contractValue = Number(project.contract_value)
    const totalPaid = metrics.totalClientPaymentsReceived
    const pendingAmount = contractValue - totalPaid

    // Payment history (received payments)
    const paymentHistory = project.client_payments
      .filter(cp => cp.status === 'received')
      .map((cp, idx) => ({
        id: cp.id,
        stage: cp.stage_name,
        amount: Number(cp.amount),
        date: cp.received_date ? new Date(cp.received_date) : new Date(),
        status: 'paid',
        receiptNo: `RCP-${(idx + 1).toString().padStart(3, '0')}`
      }))

    // Upcoming payments
    const upcomingPayments = project.client_payments
      .filter(cp => cp.status === 'pending' || cp.status === 'overdue')
      .map(cp => {
        const dueDate = cp.due_date ? new Date(cp.due_date) : new Date()
        const isOverdue = cp.status === 'overdue' || dueDate < new Date()
        return {
          id: cp.id,
          stage: cp.stage_name,
          amount: Number(cp.amount),
          dueDate,
          status: isOverdue ? 'overdue' : 'upcoming'
        }
      })

    // Next payment due
    const nextPayment = upcomingPayments.length > 0 ? upcomingPayments[0] : null

    // Milestones for display (no cost info)
    const milestones = project.milestones.map(ms => ({
      name: ms.name,
      status: ms.status
    }))

    return {
      name: project.name,
      siteAddress: project.site_address,
      currentStage: currentMilestone?.name || 'Foundation',
      startDate: project.start_date ? new Date(project.start_date) : new Date(),
      expectedEndDate: project.expected_completion_date ? new Date(project.expected_completion_date) : new Date(),
      projectManager: getProjectPmLabel(project),
      siteEngineers: getProjectEngineersLabel(project),
      contractValue,
      totalPaid,
      pendingAmount,
      progress: Math.round(progress),
      nextPayment,
      paymentHistory,
      upcomingPayments,
      milestones
    }
  }, [project, metrics])

  if (isLoading) {
    return (
      <PageShell>
        <DashboardHeader />
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your project...</p>
          </div>
        </div>
      </PageShell>
    )
  }

  if (error || !project || !customerData) {
    const message =
      error instanceof Error ? error.message : NO_ASSIGNED_PROJECT_MESSAGE
    return (
      <PageShell>
        <DashboardHeader />
        <div className="flex max-w-lg flex-col items-center justify-center gap-2 px-6 py-24 text-center mx-auto">
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
          title="My Project"
          description="Track your project payments and progress"
        />

        <Card className="section-card">
          <CardHeader>
            <CardTitle>{customerData.name}</CardTitle>
            <CardDescription>View payment schedule and progress</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Project Info - Limited to what customer should see */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Site Address</p>
                </div>
                <p className="text-sm font-medium">{customerData.siteAddress}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Current Stage</p>
                </div>
                <p className="text-sm font-medium">{customerData.currentStage}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Expected Completion</p>
                </div>
                <p className="text-sm font-medium">{format(customerData.expectedEndDate, "dd MMM yyyy")}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Project Manager</p>
                </div>
                <p className={cn(
                  "text-sm font-medium",
                  customerData.projectManager.includes("not created") && "text-muted-foreground italic"
                )}>{customerData.projectManager}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <HardHat className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Site Engineer</p>
                </div>
                <p className={cn(
                  "text-sm font-medium",
                  customerData.siteEngineers.includes("not created") && "text-muted-foreground italic"
                )}>{customerData.siteEngineers}</p>
              </div>
            </div>

            {/* Payment Summary - What customer paid */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Contract Value</p>
                <p className="text-xl font-bold">{formatINR(customerData.contractValue)}</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Amount Paid</p>
                <p className="text-xl font-bold text-green-500">{formatINR(customerData.totalPaid)}</p>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Balance Pending</p>
                <p className="text-xl font-bold text-yellow-500">{formatINR(customerData.pendingAmount)}</p>
              </div>
            </div>

            {/* Progress Bar - Simple overall progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Project Progress</span>
                <span className="text-sm text-muted-foreground">{customerData.progress}%</span>
              </div>
              <Progress value={customerData.progress} className="h-3" />
            </div>

            {/* Next Payment Highlight */}
            {customerData.nextPayment && (
              <Card className="border-primary/50 bg-primary/5 mb-6">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <IndianRupee className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Next Payment Due</p>
                        <p className="text-xl font-bold">{formatINR(customerData.nextPayment.amount)}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Stage: {customerData.nextPayment.stage}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Due: {format(customerData.nextPayment.dueDate, "dd MMM yyyy")}</span>
                      </div>
                      <Button className="gap-2">
                        <IndianRupee className="h-4 w-4" />
                        Pay Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs for Payment History and Schedule */}
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upcoming">Upcoming Payments</TabsTrigger>
                <TabsTrigger value="history">Payment History</TabsTrigger>
                <TabsTrigger value="milestones">Project Milestones</TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="mt-4">
                {customerData.upcomingPayments.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No upcoming payments</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Due Date</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerData.upcomingPayments.map((payment) => (
                        <TableRow key={payment.id} className="border-border">
                          <TableCell className="font-medium">{payment.stage}</TableCell>
                          <TableCell className="text-right">{formatINR(payment.amount)}</TableCell>
                          <TableCell className="text-right">{format(payment.dueDate, "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={payment.status === "overdue" ? "destructive" : "outline"}
                            >
                              {payment.status === "overdue" ? "Overdue" : "Upcoming"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {customerData.paymentHistory.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No payment history</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead>Stage</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Date Paid</TableHead>
                          <TableHead className="text-right">Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerData.paymentHistory.map((payment) => (
                          <TableRow key={payment.id} className="border-border">
                            <TableCell className="font-medium">{payment.stage}</TableCell>
                            <TableCell className="text-right text-green-500">{formatINR(payment.amount)}</TableCell>
                            <TableCell className="text-right">{format(payment.date, "dd MMM yyyy")}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="gap-1">
                                <Download className="h-4 w-4" />
                                {payment.receiptNo}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Total Payments Made</p>
                        <p className="text-xs text-muted-foreground">{customerData.paymentHistory.length} transactions</p>
                      </div>
                      <p className="text-xl font-bold text-green-500">{formatINR(customerData.totalPaid)}</p>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="milestones" className="mt-4">
                {/* Milestones - Only status visible, no cost details */}
                <div className="space-y-4">
                  {customerData.milestones.map((milestone, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        milestone.status === "completed" ? "bg-green-500/20 text-green-500" :
                        milestone.status === "in-progress" ? "bg-primary/20 text-primary" :
                        "bg-muted text-muted-foreground"
                      )}>
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
                      <Badge variant={
                        milestone.status === "completed" ? "default" :
                        milestone.status === "in-progress" ? "secondary" : "outline"
                      }>
                        {milestone.status === "completed" ? "Completed" : 
                         milestone.status === "in-progress" ? "In Progress" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground text-center">
                  Contact your project manager for detailed progress updates
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </PageMain>
    </PageShell>
  )
}
