"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts"
import { Download, FileText, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatINR } from "@/lib/currency"
import { summarizeProjectFinancials } from "@/lib/financial-calculations"
import type { ProjectWithDetails } from "@/lib/types/database"

interface Milestone {
  id: string
  name: string
  target_budget: number
  actual_expenses: number
  expected_cost_percent: number
}

interface Expense {
  id: string
  milestone_id: string | null
  category: string
  amount: number
  expense_date: string
  status: string
}

const COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]

interface ReportsTabProps {
  projectId?: string
  project?: ProjectWithDetails
}

export function ReportsTab({ projectId: propProjectId, project }: ReportsTabProps = {}) {
  const params = useParams()
  const projectId = propProjectId || project?.id || (params?.id as string)
  const [selectedReport, setSelectedReport] = useState("estimate-vs-actual")
  const [loading, setLoading] = useState(!project)
  const [milestones, setMilestones] = useState<Milestone[]>(() =>
    project
      ? project.milestones.map((m) => ({
          id: m.id,
          name: m.name,
          target_budget: Number(m.target_budget),
          actual_expenses: Number(m.actual_expenses),
          expected_cost_percent: Number(m.expected_cost_percent),
        }))
      : [],
  )
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    project
      ? project.expenses.map((e) => ({
          id: e.id,
          milestone_id: e.milestone_id,
          category: e.category,
          amount: Number(e.amount),
          expense_date: e.expense_date,
          status: e.status,
        }))
      : [],
  )

  useEffect(() => {
    if (project) {
      setMilestones(
        project.milestones.map((m) => ({
          id: m.id,
          name: m.name,
          target_budget: Number(m.target_budget),
          actual_expenses: Number(m.actual_expenses),
          expected_cost_percent: Number(m.expected_cost_percent),
        })),
      )
      setExpenses(
        project.expenses.map((e) => ({
          id: e.id,
          milestone_id: e.milestone_id,
          category: e.category,
          amount: Number(e.amount),
          expense_date: e.expense_date,
          status: e.status,
        })),
      )
      setLoading(false)
      return
    }
    fetchData()
  }, [projectId, project])

  async function fetchData() {
    if (!projectId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
    const supabase = createClient()
    
    // Fetch milestones
    const { data: milestonesData, error: milestonesError } = await supabase
      .from('milestones')
      .select('id, name, target_budget, actual_expenses, expected_cost_percent')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
    
    if (milestonesError) {
      console.error("Error fetching milestones:", milestonesError)
    } else {
      setMilestones(milestonesData || [])
    }
    
    // Fetch expenses
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('id, milestone_id, category, amount, expense_date, status')
      .eq('project_id', projectId)
      .order('expense_date', { ascending: true })
    
    if (expensesError) {
      console.error("Error fetching expenses:", expensesError)
    } else {
      setExpenses(expensesData || [])
    }
    } finally {
      setLoading(false)
    }
  }

  // Calculate actual expenses per milestone from expenses table
  const getActualExpenseForMilestone = (milestoneId: string) => {
    return expenses
      .filter(exp => exp.milestone_id === milestoneId && exp.status === 'approved')
      .reduce((sum, exp) => sum + Number(exp.amount), 0)
  }

  // Prepare data for Estimate vs Actual chart
  const estimateVsActualData = milestones.map(ms => ({
    stage: ms.name,
    estimated: Number(ms.target_budget),
    actual: getActualExpenseForMilestone(ms.id)
  }))

  // Prepare data for Stage Cost Analysis (Pie chart) - only stages with expenses
  const stageCostAnalysisData = milestones
    .map((ms, index) => ({
      name: ms.name,
      value: getActualExpenseForMilestone(ms.id),
      fill: COLORS[index % COLORS.length]
    }))
    .filter(item => item.value > 0)

  // Prepare data for Category-wise expenses
  const categoryExpenses: Record<string, number> = {}
  expenses.filter(exp => exp.status === 'approved').forEach(exp => {
    const category = exp.category || 'Other'
    categoryExpenses[category] = (categoryExpenses[category] || 0) + Number(exp.amount)
  })
  
  const categoryExpensesData = Object.entries(categoryExpenses).map(([category, amount], index) => ({
    name: category,
    value: amount,
    fill: COLORS[index % COLORS.length]
  }))

  // Prepare monthly spending data
  const monthlySpending: Record<string, number> = {}
  expenses.filter(exp => exp.status === 'approved').forEach(exp => {
    if (exp.expense_date) {
      const date = new Date(exp.expense_date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + Number(exp.amount)
    }
  })
  
  const monthlySpendingData = Object.entries(monthlySpending)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, spending]) => {
      const [year, month] = key.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        spending
      }
    })

  const reports = [
    { id: "estimate-vs-actual", name: "Estimate vs Actual" },
    { id: "stage-cost-analysis", name: "Stage Cost Analysis" },
    { id: "category-analysis", name: "Category Analysis" },
    { id: "monthly-spending", name: "Monthly Spending" },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    )
  }

  const totalExpenses = expenses
    .filter(exp => exp.status === 'approved')
    .reduce((sum, exp) => sum + Number(exp.amount), 0)

  const projectFinances = project
    ? summarizeProjectFinancials({
        contractValue: Number(project.contract_value),
        additionalWorksApproved: project.additional_works
          .filter((aw) => aw.approval_status === "approved")
          .reduce((sum, aw) => sum + Number(aw.amount), 0),
        expectedMarginPercent: Number(project.expected_margin_percent),
        totalExpenses,
      })
    : null

  const totalStageBudget =
    projectFinances?.stageBudget ??
    milestones.reduce((sum, ms) => sum + Number(ms.target_budget), 0)
  const remainingStageBudget =
    projectFinances?.remainingStageBudget ?? totalStageBudget - totalExpenses

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {projectFinances ? (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Contract Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(projectFinances.totalContractValue)}</div>
            </CardContent>
          </Card>
        ) : null}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Stage Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatINR(totalStageBudget)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spent (approved)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatINR(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining Stage Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${remainingStageBudget >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {formatINR(remainingStageBudget)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Selector */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Select value={selectedReport} onValueChange={setSelectedReport}>
          <SelectTrigger className="w-[250px] bg-muted border-border">
            <FileText className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select report" />
          </SelectTrigger>
          <SelectContent>
            {reports.map((report) => (
              <SelectItem key={report.id} value={report.id}>{report.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Estimate vs Actual */}
      {selectedReport === "estimate-vs-actual" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Estimate vs Actual by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {estimateVsActualData.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No milestone data available
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={estimateVsActualData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="stage" 
                      stroke="#9ca3af" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      formatter={(value: number) => [formatINR(value), '']}
                    />
                    <Legend />
                    <Bar dataKey="estimated" name="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actual" name="Actual" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stage Cost Analysis */}
      {selectedReport === "stage-cost-analysis" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Stage Cost Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stageCostAnalysisData.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No expense data available for stages
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stageCostAnalysisData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {stageCostAnalysisData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(value: number) => [formatINR(value), 'Cost']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Category Analysis */}
      {selectedReport === "category-analysis" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Expense by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryExpensesData.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No expense data available
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryExpensesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryExpensesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(value: number) => [formatINR(value), 'Cost']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly Spending */}
      {selectedReport === "monthly-spending" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySpendingData.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No expense data available
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlySpendingData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(value: number) => [formatINR(value), 'Spending']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="spending" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
