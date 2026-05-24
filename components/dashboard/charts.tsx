"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { Loader2 } from "lucide-react"
import { formatINR, formatINRCompact } from "@/lib/currency"
import { useDefaultProject } from "@/lib/hooks/use-project-data"

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
            {entry.name}: {formatINR(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function EstimateVsActualChart() {
  const { project, isLoading, error } = useDefaultProject()

  const chartData = useMemo(() => {
    if (!project) return []
    
    // Use milestone data to show estimate vs actual
    return project.milestones.slice(0, 6).map(ms => ({
      name: ms.name.length > 10 ? ms.name.slice(0, 10) + '...' : ms.name,
      estimate: Number(ms.target_budget),
      actual: Number(ms.actual_expenses)
    }))
  }, [project])

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-2">
        <CardContent className="pt-6 flex items-center justify-center h-[320px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base font-medium">Estimate vs Actual</CardTitle>
        <p className="text-xs text-muted-foreground">Financial tracking by milestone</p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickFormatter={(value) => formatINRCompact(value)}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-xs text-muted-foreground capitalize">{value}</span>}
              />
              <Bar dataKey="estimate" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Budget" />
              <Bar dataKey="actual" fill="var(--chart-2)" radius={[4, 4, 0, 0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function StageProgressChart() {
  const { project, isLoading, error } = useDefaultProject()

  const chartData = useMemo(() => {
    if (!project) return []
    
    // Group milestones by status
    const completed = project.milestones.filter(ms => ms.status === 'completed').length
    const inProgress = project.milestones.filter(ms => ms.status === 'in-progress').length
    const pending = project.milestones.filter(ms => ms.status === 'pending').length
    const total = project.milestones.length || 1
    
    return [
      { name: "Completed", value: Math.round((completed / total) * 100), fill: "var(--chart-1)" },
      { name: "In Progress", value: Math.round((inProgress / total) * 100), fill: "var(--chart-2)" },
      { name: "Pending", value: Math.round((pending / total) * 100), fill: "var(--chart-3)" },
    ].filter(item => item.value > 0)
  }, [project])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center h-[320px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Stage Progress</CardTitle>
        <p className="text-xs text-muted-foreground">Milestone status distribution</p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
                        <p className="text-xs text-muted-foreground">{payload[0].value}% of milestones</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend 
                layout="vertical" 
                verticalAlign="middle" 
                align="right"
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function MonthlySpendingChart() {
  const { project, isLoading, error } = useDefaultProject()

  const chartData = useMemo(() => {
    if (!project) return []
    
    // Group expenses by month
    const expensesByMonth: Record<string, number> = {}
    
    project.expenses
      .filter(e => e.status === 'approved')
      .forEach(expense => {
        const date = new Date(expense.expense_date)
        const monthKey = date.toLocaleDateString('en-US', { month: 'short' })
        expensesByMonth[monthKey] = (expensesByMonth[monthKey] || 0) + Number(expense.amount)
      })

    // Convert to array and sort by month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months
      .filter(month => expensesByMonth[month])
      .map(month => ({
        name: month,
        spending: expensesByMonth[month]
      }))
  }, [project])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center h-[320px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Monthly Spending</CardTitle>
        <p className="text-xs text-muted-foreground">Expense trend by month</p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No expense data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  tickFormatter={(value) => formatINRCompact(value)}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            Spending: {formatINR(payload[0].value as number)}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="spending" 
                  stroke="var(--chart-3)" 
                  strokeWidth={2}
                  dot={{ fill: 'var(--chart-3)', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, stroke: 'var(--chart-3)', strokeWidth: 2, fill: 'var(--background)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardCharts() {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
      <EstimateVsActualChart />
      <StageProgressChart />
      <MonthlySpendingChart />
    </div>
  )
}
