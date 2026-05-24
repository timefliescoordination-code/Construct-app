"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  IndianRupee, 
  TrendingUp,
  Wallet,
  PiggyBank,
  Percent,
  BarChart3,
  Calendar
} from "lucide-react"

interface EditOverviewTabProps {
  project: {
    contractValue: number
    currentSpending: number
    remainingBudget: number
    currentProfit: number
    completionPercent: number
    budgetUsagePercent: number
    startDate: string
    expectedEndDate: string
  }
  onUpdate: (field: string, value: unknown) => void
}

export function EditOverviewTab({ project, onUpdate }: EditOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Financial Widgets Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" />
            Financial Overview
          </CardTitle>
          <CardDescription>
            Update project financial information and budget details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Contract Value - Editable by PM */}
            <div className="space-y-2">
              <Label htmlFor="contractValue" className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                Contract Value
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  id="contractValue"
                  type="number"
                  value={project.contractValue}
                  onChange={(e) => onUpdate("contractValue", Number(e.target.value))}
                  className="pl-7 bg-background"
                />
              </div>
            </div>

            {/* Current Spending - Read Only (from site engineer entries) */}
            <div className="space-y-2">
              <Label htmlFor="currentSpending" className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Current Spending
                <Badge variant="secondary" className="text-[10px] ml-1">Auto</Badge>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  id="currentSpending"
                  type="number"
                  value={project.currentSpending}
                  className="pl-7 bg-muted/50 text-muted-foreground cursor-not-allowed"
                  readOnly
                  disabled
                />
              </div>
              <p className="text-xs text-muted-foreground">Captured from site engineer daily entries</p>
            </div>

            {/* Remaining Budget - Read Only (auto-calculated) */}
            <div className="space-y-2">
              <Label htmlFor="remainingBudget" className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
                Remaining Budget
                <Badge variant="secondary" className="text-[10px] ml-1">Auto</Badge>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  id="remainingBudget"
                  type="number"
                  value={project.remainingBudget}
                  className="pl-7 bg-muted/50 text-muted-foreground cursor-not-allowed"
                  readOnly
                  disabled
                />
              </div>
              <p className="text-xs text-muted-foreground">Contract Value - Current Spending</p>
            </div>

            {/* Current Profit - Read Only (auto-calculated) */}
            <div className="space-y-2">
              <Label htmlFor="currentProfit" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Current Profit
                <Badge variant="secondary" className="text-[10px] ml-1">Auto</Badge>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  id="currentProfit"
                  type="number"
                  value={project.currentProfit}
                  className="pl-7 bg-muted/50 text-muted-foreground cursor-not-allowed"
                  readOnly
                  disabled
                />
              </div>
              <p className="text-xs text-muted-foreground">Payments Received - Total Expenses</p>
            </div>

            {/* Completion % - Read Only (from milestone progress) */}
            <div className="space-y-2">
              <Label htmlFor="completionPercent" className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                Completion %
                <Badge variant="secondary" className="text-[10px] ml-1">Auto</Badge>
              </Label>
              <div className="relative">
                <Input
                  id="completionPercent"
                  type="number"
                  value={project.completionPercent}
                  className="pr-7 bg-muted/50 text-muted-foreground cursor-not-allowed"
                  readOnly
                  disabled
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Calculated from milestone progress</p>
            </div>

            {/* Budget Usage % - Read Only (from milestone entries) */}
            <div className="space-y-2">
              <Label htmlFor="budgetUsagePercent" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Budget Usage %
                <Badge variant="secondary" className="text-[10px] ml-1">Auto</Badge>
              </Label>
              <div className="relative">
                <Input
                  id="budgetUsagePercent"
                  type="number"
                  value={project.budgetUsagePercent}
                  className="pr-7 bg-muted/50 text-muted-foreground cursor-not-allowed"
                  readOnly
                  disabled
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Spending / Total Stage Budget x 100</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Project Timeline
          </CardTitle>
          <CardDescription>
            Set project start and end dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={project.startDate}
                onChange={(e) => onUpdate("startDate", e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedEndDate">Expected End Date</Label>
              <Input
                id="expectedEndDate"
                type="date"
                value={project.expectedEndDate}
                onChange={(e) => onUpdate("expectedEndDate", e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
