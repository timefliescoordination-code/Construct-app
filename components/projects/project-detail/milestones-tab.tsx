"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  IndianRupee,
  Target,
  Calculator,
  Plus,
  Pencil,
  Trash2,
  Save,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatINR } from "@/lib/currency"
import {
  calculateTotalContractValue,
  calculateExpectedProfit,
  calculateStageBudget,
  calculateMilestoneCompletionFromExpenses,
} from "@/lib/financial-calculations"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"
import { canViewProjectFinancials } from "@/lib/permissions"
import type { ProjectWithDetails } from "@/lib/types/database"
import { milestonesWithCalculatedExpenses } from "@/lib/project-tab-hydration"
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
  updateMilestonesAction,
} from "@/lib/projects/tab-actions"

// Helper function to round to nearest 0.25%
function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4
}

// Helper function to format percentage with proper decimals
function formatPercent(value: number): string {
  const rounded = roundToQuarter(value)
  if (rounded % 1 === 0) return `${rounded}%`
  if (rounded % 0.5 === 0) return `${rounded}%`
  return `${rounded.toFixed(2)}%`
}

interface Milestone {
  id: string
  name: string
  expected_cost_percent: number
  expected_duration: string | null
  actual_completion_percent: number
  actual_expenses: number
  target_budget: number
  notes: string | null
  status: "completed" | "in-progress" | "pending"
  sort_order: number
}

interface Project {
  id: string
  name: string
  contract_value: number
  additional_works_value: number
  expected_margin_percent: number
}

interface MilestonesTabProps {
  projectId?: string
  project?: ProjectWithDetails
  onProjectChange?: () => void
}

function projectHeaderFromDetails(p: ProjectWithDetails): Project {
  return {
    id: p.id,
    name: p.name,
    contract_value: Number(p.contract_value),
    additional_works_value: Number(p.additional_works_value),
    expected_margin_percent: Number(p.expected_margin_percent),
  }
}

export function MilestonesTab({
  projectId: propProjectId,
  project: projectDetails,
  onProjectChange,
}: MilestonesTabProps = {}) {
  const { role, canManageProjects } = useAuth()
  const showFinancials = canViewProjectFinancials(role)
  const params = useParams()
  const projectId = propProjectId || projectDetails?.id || (params?.id as string)
  
  const [project, setProject] = useState<Project | null>(() =>
    projectDetails ? projectHeaderFromDetails(projectDetails) : null,
  )
  const [milestones, setMilestones] = useState<Milestone[]>(() =>
    projectDetails ? milestonesWithCalculatedExpenses(projectDetails) as Milestone[] : [],
  )
  const [loading, setLoading] = useState(!projectDetails)
  const [saving, setSaving] = useState(false)
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [editedMilestones, setEditedMilestones] = useState<Milestone[]>([])
  
  // Add milestone dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newMilestone, setNewMilestone] = useState({
    name: "",
    expected_cost_percent: 0,
    expected_duration: "",
    notes: "",
    status: "pending" as const
  })
  
  // Edit single milestone dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [originalEditPercent, setOriginalEditPercent] = useState(0)

  useEffect(() => {
    if (projectDetails) {
      setProject(projectHeaderFromDetails(projectDetails))
      const hydrated = milestonesWithCalculatedExpenses(projectDetails) as Milestone[]
      setMilestones(hydrated)
      setEditedMilestones(hydrated)
      setLoading(false)
      return
    }
    fetchData()
  }, [projectId, projectDetails])

  async function fetchData() {
    if (!projectId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
    const supabase = createClient()
    
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, name, contract_value, additional_works_value, expected_margin_percent')
      .eq('id', projectId)
      .single()
    
    if (projectError) {
      console.error("Error fetching project:", projectError)
      return
    }
    
    setProject(projectData)
    
    const { data: milestonesData, error: milestonesError } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
    
    if (milestonesError) {
      console.error("Error fetching milestones:", milestonesError)
      return
    }
    
    // Fetch expenses to calculate actual expenses per milestone
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('milestone_id, amount, status')
      .eq('project_id', projectId)
    
    if (expensesError) {
      console.error("Error fetching expenses:", expensesError)
    }
    
    // Calculate actual expenses per milestone from expenses table
    const expensesByMilestone: Record<string, number> = {}
    if (expensesData) {
      expensesData
        .filter(exp => exp.status === 'approved' && exp.milestone_id)
        .forEach(exp => {
          const milestoneId = exp.milestone_id
          expensesByMilestone[milestoneId] = (expensesByMilestone[milestoneId] || 0) + Number(exp.amount)
        })
    }
    
    // Update milestones with calculated expenses and completion %
    const milestonesWithExpenses = (milestonesData || []).map(ms => {
      const actualExpenses = expensesByMilestone[ms.id] || 0
      const targetBudget = Number(ms.target_budget) || 0
      return {
        ...ms,
        actual_expenses: actualExpenses,
        actual_completion_percent: calculateMilestoneCompletionFromExpenses(
          actualExpenses,
          targetBudget,
        ),
      }
    })
    
    setMilestones(milestonesWithExpenses)
    setEditedMilestones(milestonesWithExpenses)
    } finally {
      setLoading(false)
    }
  }

  // Calculate financials
  const totalContractValue = project ? calculateTotalContractValue(
    Number(project.contract_value), 
    Number(project.additional_works_value)
  ) : 0
  const expectedProfitPercent = project ? Number(project.expected_margin_percent) : 15
  const expectedProfit = calculateExpectedProfit(totalContractValue, expectedProfitPercent)
  const totalStageBudget = calculateStageBudget(totalContractValue, expectedProfit)

  // Handle percentage change with auto-adjustment
  // Calculate total allocated percentage (excluding a specific milestone if editing)
  const getTotalAllocated = (excludeId?: string) => {
    const source = editMode ? editedMilestones : milestones
    return source
      .filter(m => m.id !== excludeId)
      .reduce((sum, m) => sum + m.expected_cost_percent, 0)
  }

  // Get remaining percentage available
  const getRemainingPercent = (excludeId?: string) => {
    return roundToQuarter(100 - getTotalAllocated(excludeId))
  }

  const handlePercentageChange = (milestoneId: string, newPercent: number) => {
    const currentMilestones = [...editedMilestones]
    const changedIndex = currentMilestones.findIndex(m => m.id === milestoneId)
    
    if (changedIndex === -1) return
    
    // Round to nearest 0.25%
    const roundedNewPercent = roundToQuarter(newPercent)
    
    // Calculate max allowed for this milestone (remaining + current value)
    const otherTotal = currentMilestones
      .filter((_, i) => i !== changedIndex)
      .reduce((sum, m) => sum + m.expected_cost_percent, 0)
    const maxAllowed = roundToQuarter(100 - otherTotal)
    
    // Clamp value to max allowed
    const clampedPercent = Math.min(Math.max(0, roundedNewPercent), maxAllowed)
    
    // Update the changed milestone
    currentMilestones[changedIndex] = {
      ...currentMilestones[changedIndex],
      expected_cost_percent: clampedPercent,
      target_budget: (totalStageBudget * clampedPercent) / 100
    }
    
    setEditedMilestones(currentMilestones)
  }

  // Save all milestone changes
  const handleSaveAll = async () => {
    // Validate total doesn't exceed 100%
    const totalPercent = editedMilestones.reduce((sum, m) => sum + m.expected_cost_percent, 0)
    if (totalPercent > 100) {
      toast.error(`Total allocation is ${formatPercent(totalPercent)}. Please reduce to 100% or less.`)
      return
    }
    
    setSaving(true)

    const result = await updateMilestonesAction({
      projectId,
      milestones: editedMilestones.map((m) => ({
        id: m.id,
        expected_cost_percent: m.expected_cost_percent,
        target_budget: m.target_budget,
        status: m.status,
        notes: m.notes,
      })),
    })

    if (!result.ok) {
      toast.error(result.error)
    } else {
      setMilestones(editedMilestones)
      setEditMode(false)
      onProjectChange?.()
      toast.success("All milestones updated successfully")
    }

    setSaving(false)
  }

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditedMilestones(milestones)
    setEditMode(false)
  }

  // Add new milestone
  const handleAddMilestone = async () => {
    if (!newMilestone.name.trim()) {
      toast.error("Please enter a milestone name")
      return
    }
    
    // Validate percentage doesn't exceed 100%
    const currentTotal = getTotalAllocated()
    if (currentTotal + newMilestone.expected_cost_percent > 100) {
      toast.error(`Cannot add ${formatPercent(newMilestone.expected_cost_percent)}. Only ${formatPercent(100 - currentTotal)} available.`)
      return
    }
    
    setSaving(true)

    const maxSortOrder = Math.max(...milestones.map((m) => m.sort_order), 0)
    const result = await createMilestoneAction({
      projectId,
      name: newMilestone.name,
      expected_cost_percent: newMilestone.expected_cost_percent,
      target_budget: (totalStageBudget * newMilestone.expected_cost_percent) / 100,
      expected_duration: newMilestone.expected_duration || null,
      notes: newMilestone.notes || null,
      status: newMilestone.status,
      sort_order: maxSortOrder + 1,
    })

    if (!result.ok) {
      toast.error(result.error)
      setSaving(false)
      return
    }

    const data = result.data as Milestone
    setMilestones([...milestones, data])
    setEditedMilestones([...editedMilestones, data])
    onProjectChange?.()
    setNewMilestone({
      name: "",
      expected_cost_percent: 0,
      expected_duration: "",
      notes: "",
      status: "pending",
    })
    setAddDialogOpen(false)
    toast.success("Milestone added successfully")
    setSaving(false)
  }

  // Delete milestone
  const handleDeleteMilestone = async (milestoneId: string) => {
    setSaving(true)

    const result = await deleteMilestoneAction({ projectId, milestoneId })

    if (!result.ok) {
      toast.error(result.error)
      setSaving(false)
      return
    }

    setMilestones(milestones.filter((m) => m.id !== milestoneId))
    setEditedMilestones(editedMilestones.filter((m) => m.id !== milestoneId))
    onProjectChange?.()
    toast.success("Milestone deleted successfully")
    setSaving(false)
  }

  // Edit single milestone
  const handleEditMilestone = async () => {
    if (!editingMilestone) return
    
    // Validate percentage doesn't exceed 100%
    const maxAllowed = getRemainingPercent(editingMilestone.id) + originalEditPercent
    
    if (editingMilestone.expected_cost_percent > maxAllowed) {
      toast.error(`Cannot set ${formatPercent(editingMilestone.expected_cost_percent)}. Maximum allowed is ${formatPercent(maxAllowed)}.`)
      return
    }
    
    setSaving(true)

    const targetBudget =
      (totalStageBudget * editingMilestone.expected_cost_percent) / 100
    const result = await updateMilestoneAction({
      projectId,
      milestoneId: editingMilestone.id,
      name: editingMilestone.name,
      expected_cost_percent: editingMilestone.expected_cost_percent,
      target_budget: targetBudget,
      expected_duration: editingMilestone.expected_duration,
      notes: editingMilestone.notes,
      status: editingMilestone.status,
    })

    if (!result.ok) {
      toast.error(result.error)
      setSaving(false)
      return
    }

    const actualExpense = Number(editingMilestone.actual_expenses) || 0
    const completionPercent = calculateMilestoneCompletionFromExpenses(
      actualExpense,
      targetBudget,
    )
    const updated = milestones.map((m) =>
      m.id === editingMilestone.id
        ? {
            ...editingMilestone,
            target_budget: targetBudget,
            actual_completion_percent: completionPercent,
          }
        : m,
    )
    setMilestones(updated)
    setEditedMilestones(updated)
    onProjectChange?.()
    setEditDialogOpen(false)
    setEditingMilestone(null)
    toast.success("Milestone updated successfully")
    setSaving(false)
  }

  const getMilestoneCompletion = (milestone: Milestone) => {
    const targetAmount =
      Number(milestone.target_budget) ||
      totalStageBudget * (milestone.expected_cost_percent / 100)
    const actualExpense = Number(milestone.actual_expenses) || 0
    return calculateMilestoneCompletionFromExpenses(actualExpense, targetAmount)
  }

  const calculateStageFinancials = (milestone: Milestone) => {
    const targetAmount = totalStageBudget * (milestone.expected_cost_percent / 100)
    const actualExpense = Number(milestone.actual_expenses) || 0
    const profitLoss = targetAmount - actualExpense
    const profitLossPercent = targetAmount > 0 ? (profitLoss / targetAmount) * 100 : 0
    const completionPercent = getMilestoneCompletion(milestone)
    return { targetAmount, profitLoss, profitLossPercent, actualExpense, completionPercent }
  }

  const displayMilestones = editMode ? editedMilestones : milestones
  const totalExpectedPercent = displayMilestones.reduce((sum, m) => sum + Number(m.expected_cost_percent), 0)
  const totalActualExpense = displayMilestones.reduce((sum, m) => sum + (Number(m.actual_expenses) || 0), 0)
  const overallProgress = displayMilestones.reduce((sum, m) => {
    const weight = Number(m.expected_cost_percent) / (totalExpectedPercent || 1)
    return sum + getMilestoneCompletion(m) * weight
  }, 0)
  const currentProfit = totalContractValue - totalActualExpense

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "in-progress":
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!project) {
    return <div className="text-center py-8 text-muted-foreground">Project not found</div>
  }

  return (
    <div className="space-y-6">
      {showFinancials && (
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Profit Calculation Formula
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-background border">
              <span className="text-muted-foreground">Contract Value</span>
              <span className="font-bold">{formatINR(totalContractValue)}</span>
            </div>
            <span className="text-muted-foreground">-</span>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/20">
              <span className="text-muted-foreground">Expected Profit ({expectedProfitPercent}%)</span>
              <span className="font-bold text-green-500">{formatINR(expectedProfit)}</span>
            </div>
            <span className="text-muted-foreground">=</span>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
              <span className="text-muted-foreground">Total Stage Budget (100%)</span>
              <span className="font-bold text-primary">{formatINR(totalStageBudget)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Summary Cards */}
      <div className={cn("grid gap-4", showFinancials ? "md:grid-cols-3" : "md:grid-cols-2")}>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallProgress.toFixed(1)}%</div>
            <Progress value={overallProgress} className="mt-2" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Total Expense (Actual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(totalActualExpense)}</div>
            <p className="text-xs text-muted-foreground">from site engineer entries</p>
          </CardContent>
        </Card>
        {showFinancials && (
        <Card className={cn(
          "bg-card border-border",
          currentProfit >= expectedProfit ? "border-green-500/30" : "border-red-500/30"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {currentProfit >= expectedProfit ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Current Profit Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              currentProfit >= expectedProfit ? "text-green-500" : "text-red-500"
            )}>
              {formatINR(currentProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              vs expected {formatINR(expectedProfit)}
            </p>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Milestones List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Project Stages</CardTitle>
              <CardDescription>
                {showFinancials
                  ? "Stage-wise budget allocation and actual expense tracking"
                  : "Stage progress and site expense tracking"}
              </CardDescription>
            </div>
            {canManageProjects && (
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <div className="text-sm mr-2">
                    <span className="text-muted-foreground">Allocated: </span>
                    <span className={cn(
                      "font-medium",
                      getTotalAllocated() === 100 ? "text-green-500" : getTotalAllocated() > 100 ? "text-red-500" : "text-yellow-500"
                    )}>
                      {formatPercent(getTotalAllocated())}
                    </span>
                    <span className="text-muted-foreground"> / 100%</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveAll} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? "Saving..." : "Save All"}
                  </Button>
                </>
              ) : (
                <>
                  <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Stage
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Stage</DialogTitle>
                        <DialogDescription>
                          Add a new milestone/stage to this project
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Stage Name</Label>
                          <Input
                            id="name"
                            placeholder="e.g., Foundation, Plinth, etc."
                            value={newMilestone.name}
                            onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="percent">Budget Allocation (%)</Label>
                          <Input
                            id="percent"
                            type="number"
                            min="0"
                            max={getRemainingPercent()}
                            step="0.25"
                            placeholder="e.g., 15"
                            value={newMilestone.expected_cost_percent || ""}
                            onChange={(e) => {
                              const val = Math.min(parseFloat(e.target.value) || 0, getRemainingPercent())
                              setNewMilestone({ ...newMilestone, expected_cost_percent: roundToQuarter(val) })
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Available: {formatPercent(getRemainingPercent())} | Target: {formatINR((totalStageBudget * newMilestone.expected_cost_percent) / 100)}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="duration">Expected Duration</Label>
                          <Input
                            id="duration"
                            placeholder="e.g., 4 weeks"
                            value={newMilestone.expected_duration}
                            onChange={(e) => setNewMilestone({ ...newMilestone, expected_duration: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            placeholder="Any additional notes..."
                            value={newMilestone.notes}
                            onChange={(e) => setNewMilestone({ ...newMilestone, notes: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddMilestone} disabled={saving}>
                          {saving ? "Adding..." : "Add Stage"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" onClick={() => setEditMode(true)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit Percentages
                  </Button>
                </>
              )}
            </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {displayMilestones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No milestones found for this project
            </div>
          ) : (
            <div className="space-y-3">
              {displayMilestones.map((milestone, index) => {
                const { targetAmount, profitLoss, profitLossPercent, actualExpense, completionPercent } = calculateStageFinancials(milestone)
                const isOverBudget = profitLoss < 0
                const hasExpense = actualExpense > 0
                
                return (
                  <div 
                    key={milestone.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      milestone.status === "completed" && (showFinancials ? !isOverBudget : true) && "border-green-500/30 bg-green-500/5",
                      milestone.status === "completed" && showFinancials && isOverBudget && "border-red-500/30 bg-red-500/5",
                      milestone.status === "in-progress" && "border-yellow-500/30 bg-yellow-500/5",
                      milestone.status === "pending" && "border-border bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium shrink-0">
                          {index + 1}
                        </div>
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusIcon(milestone.status)}
                            <h4 className="font-semibold">{milestone.name}</h4>
                            <Badge variant="outline" className={cn(
                              milestone.status === "completed" && "bg-green-500/20 text-green-500 border-green-500/30",
                              milestone.status === "in-progress" && "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
                              milestone.status === "pending" && "bg-muted text-muted-foreground"
                            )}>
                              {milestone.status === "completed" ? "Completed" : milestone.status === "in-progress" ? "In Progress" : "Pending"}
                            </Badge>
                          </div>
                          
                          {/* Stage Budget Info */}
                          {showFinancials && (
                          <div className="flex items-center gap-2 text-sm">
                            {editMode ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.25"
                                  className="w-20 h-8"
                                  value={milestone.expected_cost_percent}
                                  onChange={(e) => handlePercentageChange(milestone.id, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-muted-foreground">%</span>
                              </div>
                            ) : (
                              <span className="font-medium text-primary">{formatPercent(milestone.expected_cost_percent)}</span>
                            )}
                            <span className="text-muted-foreground">-</span>
                            <span className="text-muted-foreground">Target:</span>
                            <span className="font-medium">{formatINR(targetAmount)}</span>
                          </div>
                          )}

                          {/* Actual vs Target */}
                          {hasExpense && (
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Actual Expense:</span>
                                <span className="font-medium">{formatINR(actualExpense)}</span>
                              </div>
                              {showFinancials && (
                              <>
                              <Separator orientation="vertical" className="h-4" />
                              <div className={cn(
                                "flex items-center gap-1 font-medium",
                                isOverBudget ? "text-red-500" : "text-green-500"
                              )}>
                                {isOverBudget ? (
                                  <TrendingDown className="h-4 w-4" />
                                ) : (
                                  <TrendingUp className="h-4 w-4" />
                                )}
                                <span>
                                  {isOverBudget ? "Loss" : "Profit"}: {formatINR(Math.abs(profitLoss))}
                                </span>
                                <span className="text-xs">
                                  ({Math.abs(profitLossPercent).toFixed(1)}%)
                                </span>
                              </div>
                              </>
                              )}
                            </div>
                          )}

                          {milestone.notes && (
                            <p className="text-sm text-muted-foreground">{milestone.notes}</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Right side - Completion & Actions */}
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <div>
                          <div className="text-sm text-muted-foreground">Completion</div>
                          <div className="text-xl font-bold">{completionPercent}%</div>
                          {showFinancials && hasExpense && (
                            <div className={cn(
                              "text-xs font-medium mt-1 px-2 py-0.5 rounded",
                              isOverBudget ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500"
                            )}>
                              {isOverBudget ? "Over Budget" : "Under Budget"}
                            </div>
                          )}
                        </div>
                        
                        {/* Action buttons */}
                        {!editMode && canManageProjects && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingMilestone(milestone)
                                setOriginalEditPercent(milestone.expected_cost_percent)
                                setEditDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Stage</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{milestone.name}&quot;? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteMilestone(milestone.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    {milestone.status !== "pending" && (
                      <div className="mt-3 ml-11">
                        <Progress value={completionPercent} className="h-2" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Single Milestone Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
            <DialogDescription>
              Update the details for this milestone/stage
            </DialogDescription>
          </DialogHeader>
          {editingMilestone && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Stage Name</Label>
                <Input
                  id="edit-name"
                  value={editingMilestone.name}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-percent">Budget Allocation (%)</Label>
                  <Input
                    id="edit-percent"
                    type="number"
                    min="0"
                    max={100 - milestones.filter(m => m.id !== editingMilestone.id).reduce((sum, m) => sum + m.expected_cost_percent, 0)}
                    step="0.25"
                    value={editingMilestone.expected_cost_percent}
                    onChange={(e) => {
                      const otherMilestonesTotal = milestones
                        .filter(m => m.id !== editingMilestone.id)
                        .reduce((sum, m) => sum + m.expected_cost_percent, 0)
                      const maxAllowed = roundToQuarter(100 - otherMilestonesTotal)
                      const val = Math.min(Math.max(0, parseFloat(e.target.value) || 0), maxAllowed)
                      setEditingMilestone({ ...editingMilestone, expected_cost_percent: roundToQuarter(val) })
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max: {formatPercent(100 - milestones.filter(m => m.id !== editingMilestone.id).reduce((sum, m) => sum + m.expected_cost_percent, 0))} | Target: {formatINR((totalStageBudget * editingMilestone.expected_cost_percent) / 100)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Completion (%)</Label>
                  <div className="rounded-md border bg-muted/50 px-3 py-2">
                    <p className="text-lg font-semibold">
                      {calculateMilestoneCompletionFromExpenses(
                        Number(editingMilestone.actual_expenses) || 0,
                        (totalStageBudget * editingMilestone.expected_cost_percent) / 100,
                      )}
                      %
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-calculated from approved site expenses
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editingMilestone.status}
                  onValueChange={(value: "completed" | "in-progress" | "pending") => setEditingMilestone({ ...editingMilestone, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-duration">Expected Duration</Label>
                <Input
                  id="edit-duration"
                  placeholder="e.g., 4 weeks"
                  value={editingMilestone.expected_duration || ""}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, expected_duration: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  placeholder="Any additional notes..."
                  value={editingMilestone.notes || ""}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditMilestone} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage-wise Summary Table */}
      {showFinancials && displayMilestones.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Stage-wise Financial Summary</CardTitle>
            <CardDescription>
              Overview of all stages with target vs actual comparison
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Stage</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">%</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Target</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actual</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Profit/Loss</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayMilestones.map((milestone) => {
                    const { targetAmount, profitLoss, actualExpense } = calculateStageFinancials(milestone)
                    const isOverBudget = profitLoss < 0
                    return (
                      <tr key={milestone.id} className="border-b border-border/50">
                        <td className="py-3 px-2 font-medium">{milestone.name}</td>
                        <td className="py-3 px-2 text-center text-primary font-medium">{formatPercent(milestone.expected_cost_percent)}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">{formatINR(targetAmount)}</td>
                        <td className="py-3 px-2 text-right font-medium">
                          {actualExpense > 0 ? formatINR(actualExpense) : "-"}
                        </td>
                        <td className={cn(
                          "py-3 px-2 text-right font-medium",
                          actualExpense > 0 && (isOverBudget ? "text-red-500" : "text-green-500")
                        )}>
                          {actualExpense > 0 ? (
                            <span>{isOverBudget ? "-" : "+"}{formatINR(Math.abs(profitLoss))}</span>
                          ) : "-"}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            milestone.status === "completed" && "bg-green-500/20 text-green-500",
                            milestone.status === "in-progress" && "bg-yellow-500/20 text-yellow-500",
                            milestone.status === "pending" && "bg-muted text-muted-foreground"
                          )}>
                            {milestone.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Total Row */}
                  <tr className="bg-muted/30 font-bold">
                    <td className="py-3 px-2">Total</td>
                    <td className="py-3 px-2 text-center text-primary">{formatPercent(totalExpectedPercent)}</td>
                    <td className="py-3 px-2 text-right">{formatINR(totalStageBudget)}</td>
                    <td className="py-3 px-2 text-right">{formatINR(totalActualExpense)}</td>
                    <td className={cn(
                      "py-3 px-2 text-right",
                      totalStageBudget - totalActualExpense >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {totalStageBudget - totalActualExpense >= 0 ? "+" : "-"}
                      {formatINR(Math.abs(totalStageBudget - totalActualExpense))}
                    </td>
                    <td className="py-3 px-2 text-center">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
