"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Briefcase,
  TrendingUp,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  ChevronRight,
  Loader2,
  ClipboardList,
  Users
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/hooks/use-auth"
import { DashboardHeader } from "@/components/dashboard/header"

interface Project {
  id: string
  name: string
  customer_name: string
  site_address: string
  status: string
  contract_value: number
  expected_margin_percent: number
  milestones: Array<{
    id: string
    name: string
    status: string
    expected_cost_percent: number
    completion_percent: number
  }>
  expenses: Array<{
    id: string
    amount: number
    status: string
    description: string
    category: string
    expense_date: string
    entered_by: string | null
  }>
  client_payments: Array<{
    id: string
    amount: number
    status: string
  }>
}

interface PendingApproval {
  id: string
  type: 'expense'
  description: string
  amount: number
  project_name: string
  project_id: string
  date: string
  entered_by_name: string
}

export function PMDashboard() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchPMProjects()
    }
  }, [user])

  async function fetchPMProjects() {
    const supabase = createClient()
    
    // Fetch projects where this user is the PM
    const { data: projectsData, error } = await supabase
      .from('projects')
      .select(`
        id, name, customer_name, site_address, status, contract_value, expected_margin_percent,
        milestones (id, name, status, expected_cost_percent, completion_percent),
        expenses (id, amount, status, description, category, expense_date, entered_by),
        client_payments (id, amount, status)
      `)
      .eq('pm_id', user?.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error fetching PM projects:", error)
      setIsLoading(false)
      return
    }

    setProjects(projectsData || [])

    // Fetch pending approvals (expenses with status 'pending' from all PM's projects)
    const projectIds = (projectsData || []).map(p => p.id)
    if (projectIds.length > 0) {
      const { data: pendingExpenses } = await supabase
        .from('expenses')
        .select(`
          id, amount, description, category, expense_date, entered_by,
          projects (id, name)
        `)
        .in('project_id', projectIds)
        .eq('status', 'pending')
        .order('expense_date', { ascending: false })

      // Get entered_by user names
      const approvals: PendingApproval[] = (pendingExpenses || []).map(exp => ({
        id: exp.id,
        type: 'expense' as const,
        description: `${exp.category} - ${exp.description}`,
        amount: Number(exp.amount),
        project_name: (exp.projects as any)?.name || 'Unknown',
        project_id: (exp.projects as any)?.id || '',
        date: exp.expense_date,
        entered_by_name: 'Site Engineer'
      }))

      setPendingApprovals(approvals)
    }

    setIsLoading(false)
  }

  // Calculate PM-specific metrics
  const pmMetrics = useMemo(() => {
    const totalProjects = projects.length
    const activeProjects = projects.filter(p => p.status === 'active').length
    const completedProjects = projects.filter(p => p.status === 'completed').length
    
    const totalContractValue = projects.reduce((sum, p) => sum + Number(p.contract_value), 0)
    
    const totalExpenses = projects.reduce((sum, p) => 
      sum + p.expenses.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0), 0)
    
    const totalReceived = projects.reduce((sum, p) => 
      sum + p.client_payments.filter(cp => cp.status === 'received').reduce((s, cp) => s + Number(cp.amount), 0), 0)

    const avgCompletion = projects.length > 0 
      ? projects.reduce((sum, p) => {
          const milestoneAvg = p.milestones.length > 0
            ? p.milestones.reduce((s, m) => s + m.completion_percent, 0) / p.milestones.length
            : 0
          return sum + milestoneAvg
        }, 0) / projects.length
      : 0

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalContractValue,
      totalExpenses,
      totalReceived,
      avgCompletion,
      pendingApprovalCount: pendingApprovals.length
    }
  }, [projects, pendingApprovals])

  async function handleApproveExpense(expenseId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('expenses')
      .update({ status: 'approved' })
      .eq('id', expenseId)

    if (!error) {
      setPendingApprovals(prev => prev.filter(a => a.id !== expenseId))
      fetchPMProjects() // Refresh data
    }
  }

  async function handleRejectExpense(expenseId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('expenses')
      .update({ status: 'rejected' })
      .eq('id', expenseId)

    if (!error) {
      setPendingApprovals(prev => prev.filter(a => a.id !== expenseId))
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your projects...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader notificationCount={pmMetrics.pendingApprovalCount} />

      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PM Dashboard</h1>
            <p className="text-muted-foreground">
              {format(new Date(), "EEEE, dd MMMM yyyy")} - Managing {pmMetrics.totalProjects} project{pmMetrics.totalProjects !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Projects</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pmMetrics.totalProjects}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pmMetrics.activeProjects} active, {pmMetrics.completedProjects} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Contract Value</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(pmMetrics.totalContractValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Completion</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pmMetrics.avgCompletion.toFixed(1)}%</div>
              <Progress value={pmMetrics.avgCompletion} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card className={cn(pmMetrics.pendingApprovalCount > 0 && "border-yellow-500/50")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
              <ClipboardList className={cn("h-4 w-4", pmMetrics.pendingApprovalCount > 0 ? "text-yellow-500" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", pmMetrics.pendingApprovalCount > 0 && "text-yellow-500")}>
                {pmMetrics.pendingApprovalCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting your action</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Projects List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>My Projects</CardTitle>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No projects assigned yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="text-right">Contract Value</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => {
                        const completion = project.milestones.length > 0
                          ? project.milestones.reduce((s, m) => s + m.completion_percent, 0) / project.milestones.length
                          : 0

                        return (
                          <TableRow key={project.id} className="border-border">
                            <TableCell>
                              <div>
                                <p className="font-medium">{project.name}</p>
                                <p className="text-sm text-muted-foreground">{project.customer_name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                                {project.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={completion} className="w-16 h-2" />
                                <span className="text-sm">{completion.toFixed(0)}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatINR(Number(project.contract_value))}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/projects/${project.id}`}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pending Approvals */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/50" />
                    <p className="mt-3 text-sm text-muted-foreground">All caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.slice(0, 5).map((approval) => (
                      <div key={approval.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{approval.description}</p>
                            <p className="text-xs text-muted-foreground">{approval.project_name}</p>
                          </div>
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{formatINR(approval.amount)}</span>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs"
                              onClick={() => handleRejectExpense(approval.id)}
                            >
                              Reject
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-7 text-xs"
                              onClick={() => handleApproveExpense(approval.id)}
                            >
                              Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {pendingApprovals.length > 5 && (
                      <Button variant="ghost" className="w-full" size="sm">
                        View all {pendingApprovals.length} pending
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
