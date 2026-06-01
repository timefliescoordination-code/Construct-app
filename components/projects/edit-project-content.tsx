"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Save,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { PAGE_MAIN_CLASS, PAGE_STACK_CLASS } from "@/components/layout/page"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { useProject, useProjectMetrics } from "@/lib/hooks/use-project-data"
import { updateProjectAction } from "@/lib/projects/actions"
import { StaffAssignmentFields } from "@/components/projects/staff-assignment-fields"
import { useStaffProfiles } from "@/lib/hooks/use-staff-profiles"
import { profileNameForClientAutofill } from "@/lib/staff-labels"
import {
  calculateProjectMetrics,
  getApprovedAdditionalWorksTotal,
  type MilestoneData,
} from "@/lib/financial-calculations"
import type { ProjectStatus } from "@/lib/types/database"
import { useAuth } from "@/lib/hooks/use-auth"
import { canViewProjectFinancials } from "@/lib/permissions"
import { EditOverviewTab } from "./edit-project/edit-overview-tab"

interface EditProjectContentProps {
  projectId: string
}

interface ProjectEditForm {
  name: string
  client_name: string
  site_address: string
  contract_value: number
  additional_works_value: number
  expected_margin_percent: number
  start_date: string
  expected_completion_date: string
  status: ProjectStatus
  pm_id: string
  customer_id: string
  assigned_engineer_ids: string[]
}

function toDateInput(value: string | null): string {
  if (!value) return ""
  return value.slice(0, 10)
}

export function EditProjectContent({ projectId }: EditProjectContentProps) {
  const router = useRouter()
  const { role, canManageProjects, isAdmin } = useAuth()
  const canEdit = canManageProjects || isAdmin
  const showFinancials = canViewProjectFinancials(role)
  const { project, isLoading, mutate } = useProject(projectId)
  const { customers } = useStaffProfiles()
  const metrics = useProjectMetrics(project)

  const [form, setForm] = useState<ProjectEditForm | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  useEffect(() => {
    if (!project) return
    setForm({
      name: project.name,
      client_name: project.client_name,
      site_address: project.site_address,
      contract_value: Number(project.contract_value),
      additional_works_value: Number(project.additional_works_value),
      expected_margin_percent: Number(project.expected_margin_percent),
      start_date: toDateInput(project.start_date),
      expected_completion_date: toDateInput(project.expected_completion_date),
      status: project.status,
      pm_id: project.pm_id ?? "",
      customer_id: project.customer_id ?? "",
      assigned_engineer_ids:
        project.project_engineers?.map((a) => a.engineer_id) ?? [],
    })
    setHasChanges(false)
  }, [project?.id, project?.updated_at])

  const overviewMetrics = useMemo(() => {
    if (!project || !form) return null

    const additionalWorksApproved = getApprovedAdditionalWorksTotal(
      project.additional_works,
      form.additional_works_value,
    )

    const milestonesForCalc: MilestoneData[] = project.milestones.map((ms) => ({
      name: ms.name,
      expectedCostPercent: Number(ms.expected_cost_percent),
      actualCompletionPercent: ms.actual_completion_percent,
      targetBudget: Number(ms.target_budget),
      actualExpenses: Number(ms.actual_expenses),
      status: ms.status,
    }))

    const calculated = calculateProjectMetrics({
      contractValue: form.contract_value,
      additionalWorks: additionalWorksApproved,
      expectedMarginPercent: form.expected_margin_percent,
      totalExpenses: metrics.totalExpenses,
      totalClientPaymentsReceived: metrics.totalClientPaymentsReceived,
      totalClientPaymentsPending: metrics.totalClientPaymentsPending,
      totalVendorPaymentsDue: metrics.totalVendorPaymentsDue,
      totalVendorPaymentsPaid: 0,
      milestones: milestonesForCalc,
    })

    return {
      originalContractValue: form.contract_value,
      additionalWorksApproved,
      totalContractValue: calculated.totalContractValue,
      stageBudget: calculated.stageBudget,
      currentSpending: calculated.totalExpenses,
      remainingBudget: calculated.remainingBudget,
      currentProfit: calculated.currentProfit,
      completionPercent: calculated.completionPercent,
      budgetUsagePercent: calculated.budgetUsagePercent,
      startDate: form.start_date,
      expectedEndDate: form.expected_completion_date,
    }
  }, [project, form, metrics])

  const updateField = useCallback((field: keyof ProjectEditForm, value: string | number) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))
    setHasChanges(true)
  }, [])

  const updateOverviewField = useCallback(
    (field: string, value: unknown) => {
      if (!form) return
      switch (field) {
        case "originalContractValue":
        case "contractValue":
          updateField("contract_value", Number(value))
          break
        case "startDate":
          updateField("start_date", String(value))
          break
        case "expectedEndDate":
          updateField("expected_completion_date", String(value))
          break
        default:
          break
      }
    },
    [form, updateField],
  )

  const handleCustomerChange = (customerId: string) => {
    setForm((prev) => {
      if (!prev) return prev
      const next = { ...prev, customer_id: customerId }
      const customer = customers.find((c) => c.id === customerId)
      const suggestedName = customer
        ? profileNameForClientAutofill(customer)
        : null
      if (suggestedName && !prev.client_name.trim()) {
        next.client_name = suggestedName
      }
      return next
    })
    setHasChanges(true)
  }

  const handlePMChange = (pmId: string) => {
    setForm((prev) => (prev ? { ...prev, pm_id: pmId } : prev))
    setHasChanges(true)
  }

  const toggleEngineer = (engineerId: string) => {
    setForm((prev) => {
      if (!prev) return prev
      const ids = prev.assigned_engineer_ids
      const assigned_engineer_ids = ids.includes(engineerId)
        ? ids.filter((id) => id !== engineerId)
        : [...ids, engineerId]
      return { ...prev, assigned_engineer_ids }
    })
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!form || !canEdit) return

    setIsSaving(true)
    try {
      const result = await updateProjectAction({
        projectId,
        name: form.name,
        client_name: form.client_name,
        site_address: form.site_address,
        contract_value: form.contract_value,
        additional_works_value: form.additional_works_value,
        expected_margin_percent: form.expected_margin_percent,
        start_date: form.start_date || null,
        expected_completion_date: form.expected_completion_date || null,
        status: form.status,
        pm_id: form.pm_id || null,
        customer_id: form.customer_id || null,
        assigned_engineer_ids: form.assigned_engineer_ids,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      await mutate()
      setHasChanges(false)
      toast.success("Project updated successfully")
    } catch (err) {
      console.error("[edit-project] save error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to save project")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasChanges) {
      setShowUnsavedDialog(true)
    } else {
      router.push(`/projects/${projectId}`)
    }
  }

  if (!canEdit) {
    return (
      <main className={cn(PAGE_MAIN_CLASS, PAGE_STACK_CLASS)}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">You do not have permission to edit projects.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href={`/projects/${projectId}`}>Back to Project</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (isLoading || !form) {
    return (
      <main
        className={cn(
          PAGE_MAIN_CLASS,
          "flex min-h-[400px] items-center justify-center",
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </main>
    )
  }

  if (!project) {
    return (
      <main className={cn(PAGE_MAIN_CLASS, PAGE_STACK_CLASS)}>
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
    <main className={cn(PAGE_MAIN_CLASS, PAGE_STACK_CLASS)}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-muted-foreground">Back to Project</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Edit Project</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              {project.name}
            </Badge>
            {hasChanges && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved Changes
              </Badge>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Card className="bg-card border-border mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={form.client_name}
                onChange={(e) => updateField("client_name", e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteAddress">Site Address</Label>
              <Input
                id="siteAddress"
                value={form.site_address}
                onChange={(e) => updateField("site_address", e.target.value)}
                className="bg-background"
              />
            </div>
            {showFinancials && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="editProjectOriginalContractValue">
                    Original Contract Value (₹)
                  </Label>
                  <Input
                    id="editProjectOriginalContractValue"
                    type="number"
                    min={0}
                    value={form.contract_value}
                    onChange={(e) => {
                      const next = e.target.value
                      updateField(
                        "contract_value",
                        next === "" ? 0 : Number(next),
                      )
                    }}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Approved additional works are added on top for total contract value.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editProjectAdditionalWorksValue">
                    Additional Works at Setup (₹)
                  </Label>
                  <Input
                    id="editProjectAdditionalWorksValue"
                    type="number"
                    min={0}
                    value={form.additional_works_value}
                    onChange={(e) => {
                      const next = e.target.value
                      updateField(
                        "additional_works_value",
                        next === "" ? 0 : Number(next),
                      )
                    }}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Amount entered at project creation. Manage line items from the
                    project detail Additional Works tab.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedMargin">Expected Margin (%)</Label>
                  <Input
                    id="expectedMargin"
                    type="number"
                    value={form.expected_margin_percent}
                    onChange={(e) =>
                      updateField("expected_margin_percent", Number(e.target.value))
                    }
                    className="bg-background"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={form.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedEndDate">Expected Completion</Label>
              <Input
                id="expectedEndDate"
                type="date"
                value={form.expected_completion_date}
                onChange={(e) => updateField("expected_completion_date", e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
          {project.updated_at && (
            <p className="text-xs text-muted-foreground mt-4">
              Last updated {format(new Date(project.updated_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mb-6">
        <StaffAssignmentFields
          assignedCustomer={form.customer_id}
          assignedPM={form.pm_id}
          assignedEngineers={form.assigned_engineer_ids}
          onCustomerChange={handleCustomerChange}
          onPMChange={handlePMChange}
          onToggleEngineer={toggleEngineer}
        />
      </div>

      {overviewMetrics && (
        <EditOverviewTab project={overviewMetrics} onUpdate={updateOverviewField} />
      )}

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => router.push(`/projects/${projectId}`)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
