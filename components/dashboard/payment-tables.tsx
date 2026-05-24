"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { formatINR } from "@/lib/currency"
import { useDefaultProject } from "@/lib/hooks/use-project-data"

function getDueBadgeVariant(dueDate: Date): "destructive" | "secondary" | "outline" {
  const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysUntilDue <= 5) return "destructive"
  if (daysUntilDue <= 10) return "secondary"
  return "outline"
}

export function UpcomingPaymentsTable() {
  const { project, isLoading, error } = useDefaultProject()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !project) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Unable to load payment data
        </CardContent>
      </Card>
    )
  }

  // Get pending client payments
  const upcomingPayments = project.client_payments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .map(p => ({
      id: p.id,
      project: project.name,
      client: project.client_name,
      amount: Number(p.amount),
      stageName: p.stage_name,
      dueDate: p.due_date ? new Date(p.due_date) : new Date()
    }))
    .slice(0, 5) // Show top 5

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">My Upcoming Payments</CardTitle>
        <p className="text-xs text-muted-foreground">Client payments for your assigned projects</p>
      </CardHeader>
      <CardContent>
        {upcomingPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No pending payments</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Project</TableHead>
                <TableHead className="text-muted-foreground">Stage</TableHead>
                <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                <TableHead className="text-muted-foreground text-right">Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingPayments.map((payment) => (
                <TableRow key={payment.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{payment.project}</TableCell>
                  <TableCell className="text-muted-foreground">{payment.stageName}</TableCell>
                  <TableCell className="text-right text-foreground">
                    {formatINR(payment.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={getDueBadgeVariant(payment.dueDate)} className="text-xs">
                      {formatDistanceToNow(payment.dueDate, { addSuffix: true })}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function VendorPendingPaymentsTable() {
  const { project, isLoading, error } = useDefaultProject()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !project) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Unable to load payment data
        </CardContent>
      </Card>
    )
  }

  // Get pending vendor payments
  const vendorPayments = project.vendor_payments
    .filter(vp => vp.status === 'pending' || vp.status === 'partial' || vp.status === 'overdue')
    .filter(vp => Number(vp.pending_amount) > 0)
    .map(vp => ({
      id: vp.id,
      vendor: vp.vendor_name,
      project: project.name,
      amount: Number(vp.pending_amount),
      dueDate: vp.due_date ? new Date(vp.due_date) : new Date()
    }))
    .slice(0, 5) // Show top 5

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">My Vendor Payments</CardTitle>
        <p className="text-xs text-muted-foreground">Vendor payments for your assigned projects</p>
      </CardHeader>
      <CardContent>
        {vendorPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No pending vendor payments</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Vendor</TableHead>
                <TableHead className="text-muted-foreground">Project</TableHead>
                <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                <TableHead className="text-muted-foreground text-right">Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorPayments.map((payment) => (
                <TableRow key={payment.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{payment.vendor}</TableCell>
                  <TableCell className="text-muted-foreground">{payment.project}</TableCell>
                  <TableCell className="text-right text-foreground">
                    {formatINR(payment.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={getDueBadgeVariant(payment.dueDate)} className="text-xs">
                      {formatDistanceToNow(payment.dueDate, { addSuffix: true })}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardTables() {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <UpcomingPaymentsTable />
      <VendorPendingPaymentsTable />
    </div>
  )
}
