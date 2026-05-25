"use client"

import { Users, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useStaffProfiles } from "@/lib/hooks/use-staff-profiles"
import {
  PM_NOT_CREATED,
  SITE_ENGINEER_NOT_CREATED,
  CUSTOMER_NOT_CREATED,
} from "@/lib/staff-labels"

const UNASSIGNED = "__unassigned__"

interface StaffAssignmentFieldsProps {
  assignedCustomer: string
  assignedPM: string
  assignedEngineers: string[]
  onCustomerChange: (customerId: string) => void
  onPMChange: (pmId: string) => void
  onToggleEngineer: (engineerId: string) => void
}

export function StaffAssignmentFields({
  assignedCustomer,
  assignedPM,
  assignedEngineers,
  onCustomerChange,
  onPMChange,
  onToggleEngineer,
}: StaffAssignmentFieldsProps) {
  const { projectManagers, siteEngineers, customers, isLoading: staffLoading } =
    useStaffProfiles()

  const customerValue = assignedCustomer || UNASSIGNED
  const pmValue = assignedPM || UNASSIGNED

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Staff Assignment</CardTitle>
        </div>
        <CardDescription>Assign customer, project manager, and site engineers</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Assign Customer</Label>
          {staffLoading ? (
            <p className="text-sm text-muted-foreground">Loading customers...</p>
          ) : customers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">{CUSTOMER_NOT_CREATED}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a customer user in Admin → User Management first.
              </p>
            </div>
          ) : (
            <Select
              value={customerValue}
              onValueChange={(v) => onCustomerChange(v === UNASSIGNED ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Not assigned</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.full_name || customer.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Project Manager</Label>
          {staffLoading ? (
            <p className="text-sm text-muted-foreground">Loading project managers...</p>
          ) : projectManagers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">{PM_NOT_CREATED}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a PM user in Admin → User Management first.
              </p>
            </div>
          ) : (
            <Select
              value={pmValue}
              onValueChange={(v) => onPMChange(v === UNASSIGNED ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Project Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Not assigned</SelectItem>
                {projectManagers.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>
                    {pm.full_name || pm.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Site Engineers</Label>
          {staffLoading ? (
            <p className="text-sm text-muted-foreground">Loading site engineers...</p>
          ) : siteEngineers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                {SITE_ENGINEER_NOT_CREATED}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a site engineer user in Admin → User Management first.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {siteEngineers.map((engineer) => (
                  <Badge
                    key={engineer.id}
                    variant={assignedEngineers.includes(engineer.id) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all",
                      assignedEngineers.includes(engineer.id)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-primary/10",
                    )}
                    onClick={() => onToggleEngineer(engineer.id)}
                  >
                    {engineer.full_name || engineer.email}
                    {assignedEngineers.includes(engineer.id) && (
                      <X className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
              {assignedEngineers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Click on site engineers to assign them
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
