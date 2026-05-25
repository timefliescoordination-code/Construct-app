"use client"

import { useState, useMemo } from "react"
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
  HardHat, 
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  Truck,
  History,
  ArrowRight,
  Loader2
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useDefaultProject, useLabourTypes } from "@/lib/hooks/use-project-data"
import { NO_ASSIGNED_PROJECT_MESSAGE } from "@/lib/project-access"
import { DashboardHeader } from "@/components/dashboard/header"

export function EngineerDashboard() {
  const { project, isLoading, error } = useDefaultProject()
  const { labourTypes } = useLabourTypes()
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    description: '',
    amount: '',
    vendor: '',
    milestoneId: ''
  })

  // Calculate engineer-specific data from project
  const engineerData = useMemo(() => {
    if (!project) return null

    const currentMilestone = project.milestones.find(ms => ms.status === 'in-progress')
    const milestones = project.milestones.map(ms => ({
      id: ms.id,
      name: ms.name,
      status: ms.status
    }))

    // Today's expenses (simplified - show recent expenses)
    const todayExpenses = project.expenses
      .slice(0, 8)
      .map(exp => ({
        id: exp.id,
        time: exp.expense_date,
        category: exp.category,
        description: exp.description,
        vendor: exp.vendor_name || 'N/A',
        amount: Number(exp.amount),
        status: exp.status
      }))

    const totalTodayExpenses = todayExpenses
      .reduce((sum, exp) => sum + exp.amount, 0)

    const pendingCount = todayExpenses.filter(exp => exp.status === 'pending').length
    
    // Unique vendors
    const activeVendors = new Set(project.expenses.map(e => e.vendor_name)).size

    return {
      projectName: project.name,
      siteAddress: project.site_address,
      currentMilestone,
      milestones,
      todayExpenses,
      totalTodayExpenses,
      pendingCount,
      labourCount: 28, // Could be calculated from labour_entries
      activeVendors
    }
  }, [project])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading site data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !project || !engineerData) {
    const message =
      error instanceof Error ? error.message : NO_ASSIGNED_PROJECT_MESSAGE
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex max-w-lg flex-col items-center justify-center gap-2 px-6 py-24 text-center">
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8 space-y-6">
        {/* Page Title & Project Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Site Dashboard</h1>
            <p className="text-muted-foreground">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
          </div>
          <div className="text-right">
            <p className="font-medium">{engineerData.projectName}</p>
            <p className="text-sm text-muted-foreground">{engineerData.siteAddress}</p>
          </div>
        </div>

        {/* Current Stage - Compact Inline Display */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current Stage:</span>
              <Badge variant="default" className="font-semibold">
                {engineerData.currentMilestone?.name || "Foundation"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowRight className="h-3 w-3" />
            Change
          </Button>
        </div>

        {/* Quick Stats - NO budget/profit info for engineer */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatINR(engineerData.totalTodayExpenses)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {engineerData.todayExpenses.length} entries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Labour Today</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{engineerData.labourCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Workers on site</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Vendors</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{engineerData.activeVendors}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique vendors</p>
            </CardContent>
          </Card>

          <Card className={cn(engineerData.pendingCount > 0 && "border-yellow-500/30")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
              <Clock className={cn("h-4 w-4", engineerData.pendingCount > 0 ? "text-yellow-500" : "text-muted-foreground")} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-xl font-bold", engineerData.pendingCount > 0 && "text-yellow-500")}>
                {engineerData.pendingCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting PM approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Expenses */}
          <div className="lg:col-span-2 space-y-6">
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
                    <Button className="gap-2">
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
                      <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={() => setIsAddExpenseOpen(false)}>
                        Submit for Approval
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <TabsContent value="today">
                <Card>
                  <CardContent className="pt-6">
                    {engineerData.todayExpenses.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">No expenses recorded yet</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {engineerData.todayExpenses.map((expense) => (
                            <TableRow key={expense.id} className="border-border">
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
                          <TableHead>Category</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {project.expenses.map((expense) => (
                          <TableRow key={expense.id} className="border-border">
                            <TableCell className="text-muted-foreground">
                              {format(new Date(expense.expense_date), "dd MMM")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{expense.category}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{expense.description}</TableCell>
                            <TableCell className="text-right">{formatINR(Number(expense.amount))}</TableCell>
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

          {/* Right Column - Labour */}
          <div className="space-y-6">
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
          </div>
        </div>
      </main>
    </div>
  )
}
