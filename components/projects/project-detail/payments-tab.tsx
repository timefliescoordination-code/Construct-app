"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import Link from "next/link"
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Printer,
} from "lucide-react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"
import type { ProjectWithDetails } from "@/lib/types/database"
import {
  createClientPaymentAction,
  createVendorPaymentAction,
  updateClientPaymentAction,
  deleteClientPaymentAction,
  updateVendorPaymentAction,
  deleteVendorPaymentAction,
} from "@/lib/projects/tab-actions"
import { ProjectFinancialSummary } from "@/components/projects/project-detail/project-financial-summary"
import { TimelineHintLines } from "@/components/dashboard/financial-layers"
import {
  buildReceivedTimelineLines,
  projectTimelineFromProject,
} from "@/lib/project-timeline"
import { ClientPaymentsPrintSheet } from "@/components/projects/project-detail/client-payments-print"

interface ClientPayment {
  id: string
  milestone_id?: string | null
  stage_name: string
  amount: number
  due_date: string | null
  received_date: string | null
  status: string
  payment_method: string | null
  reference_number: string | null
  notes: string | null
}

interface VendorPayment {
  id: string
  vendor_name: string
  total_amount: number
  amount_paid: number
  pending_amount: number
  due_date: string | null
  status: string
  category: string | null
  expense_split_group_id?: string | null
}

interface MilestoneOption {
  id: string
  name: string
}

function deriveVendorStatus(totalAmount: number, amountPaid: number) {
  if (amountPaid >= totalAmount) return "paid"
  if (amountPaid > 0) return "partial"
  return "pending"
}

function comparePaymentDates(
  dateA: string | null | undefined,
  dateB: string | null | undefined,
) {
  const hasA = Boolean(dateA)
  const hasB = Boolean(dateB)
  if (!hasA && !hasB) return 0
  if (!hasA) return 1
  if (!hasB) return -1
  return new Date(dateA!).getTime() - new Date(dateB!).getTime()
}

function sortClientPayments(payments: ClientPayment[]) {
  return [...payments].sort((a, b) => {
    const byDate = comparePaymentDates(
      a.received_date ?? a.due_date,
      b.received_date ?? b.due_date,
    )
    if (byDate !== 0) return byDate
    return a.stage_name.localeCompare(b.stage_name)
  })
}

function sortVendorPayments(payments: VendorPayment[]) {
  return [...payments].sort((a, b) => {
    const byDate = comparePaymentDates(a.due_date, b.due_date)
    if (byDate !== 0) return byDate
    return a.vendor_name.localeCompare(b.vendor_name)
  })
}

interface PaymentsTabProps {
  projectId?: string
  project?: ProjectWithDetails
  onProjectChange?: () => void
}

export function PaymentsTab({
  projectId: propProjectId,
  project,
  onProjectChange,
}: PaymentsTabProps = {}) {
  const params = useParams()
  const projectId = propProjectId || project?.id || (params?.id as string)
  const { canManageProjects } = useAuth()
  
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>(
    () => (project?.client_payments as ClientPayment[]) ?? [],
  )
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>(
    () => (project?.vendor_payments as VendorPayment[]) ?? [],
  )
  const [milestones, setMilestones] = useState<MilestoneOption[]>(() =>
    project ? project.milestones.map((m) => ({ id: m.id, name: m.name })) : [],
  )
  const [isLoading, setIsLoading] = useState(!project)
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false)
  const [isClientEditDialogOpen, setIsClientEditDialogOpen] = useState(false)
  const [isVendorEditDialogOpen, setIsVendorEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingClientPayment, setEditingClientPayment] = useState<ClientPayment | null>(null)
  const [editingVendorPayment, setEditingVendorPayment] = useState<VendorPayment | null>(null)
  const [deleteClientTarget, setDeleteClientTarget] = useState<ClientPayment | null>(null)
  const [deleteVendorTarget, setDeleteVendorTarget] = useState<VendorPayment | null>(null)
  
  // Client payment form state
  const [clientAmount, setClientAmount] = useState("")
  const [clientDate, setClientDate] = useState("")
  const [clientPaymentMode, setClientPaymentMode] = useState("")
  const [clientRemarks, setClientRemarks] = useState("")
  const [clientMilestoneId, setClientMilestoneId] = useState("")
  
  // Vendor payment form state
  const [vendorName, setVendorName] = useState("")
  const [vendorTotalAmount, setVendorTotalAmount] = useState("")
  const [vendorAmountPaid, setVendorAmountPaid] = useState("")
  const [vendorDueDate, setVendorDueDate] = useState("")
  const [vendorCategory, setVendorCategory] = useState("")

  const [editClientAmount, setEditClientAmount] = useState("")
  const [editClientDate, setEditClientDate] = useState("")
  const [editClientPaymentMode, setEditClientPaymentMode] = useState("")
  const [editClientRemarks, setEditClientRemarks] = useState("")
  const [editClientMilestoneId, setEditClientMilestoneId] = useState("")

  const [editVendorName, setEditVendorName] = useState("")
  const [editVendorTotalAmount, setEditVendorTotalAmount] = useState("")
  const [editVendorAmountPaid, setEditVendorAmountPaid] = useState("")
  const [editVendorDueDate, setEditVendorDueDate] = useState("")
  const [editVendorCategory, setEditVendorCategory] = useState("")

  useEffect(() => {
    if (project) {
      setClientPayments(sortClientPayments(project.client_payments as ClientPayment[]))
      setVendorPayments(sortVendorPayments(project.vendor_payments as VendorPayment[]))
      setMilestones(project.milestones.map((m) => ({ id: m.id, name: m.name })))
      setIsLoading(false)
      return
    }
    fetchPayments()
  }, [projectId, project])

  const fetchPayments = async () => {
    if (!projectId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    
    try {
      // Fetch client payments
      const { data: clientData, error: clientError } = await supabase
        .from('client_payments')
        .select('*')
        .eq('project_id', projectId)
      
      if (clientError) throw clientError
      setClientPayments(sortClientPayments(clientData || []))
      
      // Fetch vendor payments
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_payments')
        .select('*')
        .eq('project_id', projectId)
      
      if (vendorError) throw vendorError
      setVendorPayments(sortVendorPayments(vendorData || []))

      const { data: milestonesData, error: milestonesError } = await supabase
        .from('milestones')
        .select('id, name')
        .eq('project_id', projectId)
        .order('sort_order')

      if (milestonesError) {
        console.error("[payments-tab] fetch milestones:", milestonesError)
      } else {
        setMilestones(milestonesData || [])
      }
    } catch (error: any) {
      console.error("[v0] Error fetching payments:", error)
      toast.error(`Failed to load payments: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddClientPayment = async () => {
    const stage = milestones.find((m) => m.id === clientMilestoneId)
    if (!clientAmount || !stage) {
      toast.error("Please select a stage and enter an amount")
      return
    }
    
    setIsSubmitting(true)

    try {
      const result = await createClientPaymentAction({
        projectId,
        milestoneId: stage.id,
        stageName: stage.name,
        amount: parseFloat(clientAmount),
        receivedDate: clientDate || null,
        status: clientDate ? 'received' : 'pending',
        paymentMethod: clientPaymentMode || null,
        notes: clientRemarks || null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setClientPayments((prev) =>
        sortClientPayments([...prev, result.data as ClientPayment]),
      )
      onProjectChange?.()
      toast.success("Client payment added successfully")
      setClientAmount("")
      setClientDate("")
      setClientPaymentMode("")
      setClientRemarks("")
      setClientMilestoneId("")
      setIsClientDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddVendorPayment = async () => {
    if (!vendorName || !vendorTotalAmount) {
      toast.error("Please fill in required fields (Vendor Name and Total Amount)")
      return
    }
    
    setIsSubmitting(true)

    try {
      const amountPaid = parseFloat(vendorAmountPaid) || 0
      const totalAmount = parseFloat(vendorTotalAmount)

      const status = deriveVendorStatus(totalAmount, amountPaid)

      const result = await createVendorPaymentAction({
        projectId,
        vendorName,
        totalAmount,
        amountPaid,
        dueDate: vendorDueDate || null,
        status,
        category: vendorCategory || null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setVendorPayments((prev) =>
        sortVendorPayments([...prev, result.data as VendorPayment]),
      )
      onProjectChange?.()
      toast.success("Vendor payment added successfully")

      setVendorName("")
      setVendorTotalAmount("")
      setVendorAmountPaid("")
      setVendorDueDate("")
      setVendorCategory("")
      setIsVendorDialogOpen(false)
    } catch (error: any) {
      console.error("[v0] Error adding vendor payment:", error)
      toast.error(`Failed to add payment: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditClientDialog = (payment: ClientPayment) => {
    setEditingClientPayment(payment)
    setEditClientAmount(String(payment.amount))
    setEditClientDate(payment.received_date ?? "")
    setEditClientPaymentMode(payment.payment_method ?? "")
    setEditClientRemarks(payment.notes ?? "")
    setEditClientMilestoneId(
      payment.milestone_id ??
        milestones.find((m) => m.name === payment.stage_name)?.id ??
        "",
    )
    setIsClientEditDialogOpen(true)
  }

  const handleUpdateClientPayment = async () => {
    if (!editingClientPayment) return
    const stage = milestones.find((m) => m.id === editClientMilestoneId)
    if (!editClientAmount || !stage) {
      toast.error("Please select a stage and enter an amount")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await updateClientPaymentAction({
        projectId,
        paymentId: editingClientPayment.id,
        milestoneId: stage.id,
        stageName: stage.name,
        amount: parseFloat(editClientAmount),
        receivedDate: editClientDate || null,
        status: editClientDate ? "received" : "pending",
        paymentMethod: editClientPaymentMode || null,
        notes: editClientRemarks || null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setClientPayments((prev) =>
        sortClientPayments(
          prev.map((p) =>
            p.id === editingClientPayment.id ? (result.data as ClientPayment) : p,
          ),
        ),
      )
      onProjectChange?.()
      toast.success("Client payment updated")
      setIsClientEditDialogOpen(false)
      setEditingClientPayment(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClientPayment = async () => {
    if (!deleteClientTarget) return

    setIsSubmitting(true)
    try {
      const result = await deleteClientPaymentAction({
        projectId,
        paymentId: deleteClientTarget.id,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setClientPayments((prev) => prev.filter((p) => p.id !== deleteClientTarget.id))
      onProjectChange?.()
      toast.success("Client payment deleted")
      setDeleteClientTarget(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditVendorDialog = (payment: VendorPayment) => {
    if (payment.expense_split_group_id) {
      toast.error("Split expense payments are managed from the Expenses tab.")
      return
    }
    setEditingVendorPayment(payment)
    setEditVendorName(payment.vendor_name)
    setEditVendorTotalAmount(String(payment.total_amount))
    setEditVendorAmountPaid(String(payment.amount_paid))
    setEditVendorDueDate(payment.due_date ?? "")
    setEditVendorCategory(payment.category ?? "")
    setIsVendorEditDialogOpen(true)
  }

  const handleUpdateVendorPayment = async () => {
    if (!editingVendorPayment) return
    if (!editVendorName || !editVendorTotalAmount) {
      toast.error("Please fill in required fields (Vendor Name and Total Amount)")
      return
    }

    setIsSubmitting(true)
    try {
      const amountPaid = parseFloat(editVendorAmountPaid) || 0
      const totalAmount = parseFloat(editVendorTotalAmount)
      const status = deriveVendorStatus(totalAmount, amountPaid)

      const result = await updateVendorPaymentAction({
        projectId,
        paymentId: editingVendorPayment.id,
        vendorName: editVendorName,
        totalAmount,
        amountPaid,
        dueDate: editVendorDueDate || null,
        status,
        category: editVendorCategory || null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setVendorPayments((prev) =>
        sortVendorPayments(
          prev.map((p) =>
            p.id === editingVendorPayment.id ? (result.data as VendorPayment) : p,
          ),
        ),
      )
      onProjectChange?.()
      toast.success("Vendor payment updated")
      setIsVendorEditDialogOpen(false)
      setEditingVendorPayment(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteVendorPayment = async () => {
    if (!deleteVendorTarget) return

    setIsSubmitting(true)
    try {
      const result = await deleteVendorPaymentAction({
        projectId,
        paymentId: deleteVendorTarget.id,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setVendorPayments((prev) => prev.filter((p) => p.id !== deleteVendorTarget.id))
      onProjectChange?.()
      toast.success("Vendor payment deleted")
      setDeleteVendorTarget(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const sortedClientPayments = useMemo(
    () => sortClientPayments(clientPayments),
    [clientPayments],
  )
  const sortedVendorPayments = useMemo(
    () => sortVendorPayments(vendorPayments),
    [vendorPayments],
  )

  const totalReceived = clientPayments
    .filter(p => p.status === 'received')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPendingClient = clientPayments
    .filter((p) => p.status !== "received")
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const handlePrintClientPayments = () => {
    if (sortedClientPayments.length === 0) {
      toast.error("No client payments to print.")
      return
    }
    window.print()
  }
  const totalPaid = vendorPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const totalPending = vendorPayments.reduce((sum, p) => sum + Number(p.pending_amount || 0), 0)
  const netCashPosition = totalReceived - totalPaid - totalPending

  const receivedTimelineLines = project
    ? buildReceivedTimelineLines(projectTimelineFromProject(project))
    : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
    <div className="space-y-6 print:hidden">
      {project ? <ProjectFinancialSummary project={project} /> : null}

      {/* Cashflow Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Rs {totalReceived.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From client</p>
            <TimelineHintLines lines={receivedTimelineLines} />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">Rs {totalPaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">To vendors</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payable</CardTitle>
            <Wallet className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">Rs {totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Pending to vendors</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Cash Position</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netCashPosition >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              Rs {netCashPosition.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Current balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Payments */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-green-500" />
            Client Payments
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={handlePrintClientPayments}
              disabled={sortedClientPayments.length === 0}
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
            <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
            {canManageProjects && (
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Payment
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Record Client Payment</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Project stage *</Label>
                  {milestones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No stages found. Add stages on the Milestones tab first.
                    </p>
                  ) : (
                    <Select
                      value={clientMilestoneId}
                      onValueChange={setClientMilestoneId}
                    >
                      <SelectTrigger className="w-full bg-muted border-border">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {milestones.map((milestone) => (
                          <SelectItem key={milestone.id} value={milestone.id}>
                            {milestone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="bg-muted border-border"
                    value={clientAmount}
                    onChange={(e) => setClientAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Received Date (leave empty if pending)</Label>
                  <Input 
                    type="date" 
                    className="bg-muted border-border"
                    value={clientDate}
                    onChange={(e) => setClientDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <Select value={clientPaymentMode} onValueChange={setClientPaymentMode}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="RTGS">RTGS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Input 
                    placeholder="Payment remarks..." 
                    className="bg-muted border-border"
                    value={clientRemarks}
                    onChange={(e) => setClientRemarks(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsClientDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleAddClientPayment}
                  disabled={isSubmitting || milestones.length === 0}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead>Stage</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageProjects && (
                    <TableHead className="w-12 text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClientPayments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManageProjects ? 6 : 5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No client payments recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedClientPayments.map((payment) => (
                    <TableRow key={payment.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium">{payment.stage_name}</TableCell>
                      <TableCell className="font-medium text-green-500">
                        Rs {Number(payment.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {payment.received_date 
                          ? format(new Date(payment.received_date), "MMM dd, yyyy")
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {payment.payment_method ? (
                          <Badge variant="outline" className="bg-muted">{payment.payment_method}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {payment.status === 'received' ? (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Received</Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pending</Badge>
                        )}
                      </TableCell>
                      {canManageProjects && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isSubmitting}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditClientDialog(payment)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteClientTarget(payment)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Payments */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-destructive" />
            Vendor Payments
          </CardTitle>
          <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
            {canManageProjects && (
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Payment
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Record Vendor Payment</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input 
                    placeholder="Vendor name" 
                    className="bg-muted border-border"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={vendorCategory} onValueChange={setVendorCategory}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Materials">Materials</SelectItem>
                      <SelectItem value="Labour">Labour</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                      <SelectItem value="Transport">Transport</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Amount *</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      className="bg-muted border-border"
                      value={vendorTotalAmount}
                      onChange={(e) => setVendorTotalAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount Paid</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      className="bg-muted border-border"
                      value={vendorAmountPaid}
                      onChange={(e) => setVendorAmountPaid(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input 
                    type="date" 
                    className="bg-muted border-border"
                    value={vendorDueDate}
                    onChange={(e) => setVendorDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsVendorDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddVendorPayment} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageProjects && (
                    <TableHead className="w-12 text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVendorPayments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManageProjects ? 8 : 7}
                      className="text-center text-muted-foreground py-8"
                    >
                      No vendor payments recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedVendorPayments.map((payment) => (
                    <TableRow key={payment.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {payment.vendor_name}
                        {payment.expense_split_group_id && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-[10px] bg-primary/10 text-primary border-primary/30"
                          >
                            Split expense
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.category ? (
                          <Badge variant="outline" className="bg-muted">{payment.category}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>Rs {Number(payment.total_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-destructive">
                        Rs {Number(payment.amount_paid).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-yellow-500">
                        Rs {Number(payment.pending_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {payment.due_date 
                          ? format(new Date(payment.due_date), "MMM dd, yyyy")
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {payment.status === 'paid' ? (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>
                        ) : payment.status === 'partial' ? (
                          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Partial</Badge>
                        ) : payment.due_date && new Date(payment.due_date) < new Date() ? (
                          <Badge className="bg-destructive/20 text-destructive border-destructive/30">Overdue</Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pending</Badge>
                        )}
                      </TableCell>
                      {canManageProjects && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isSubmitting}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {payment.expense_split_group_id &&
                              payment.status !== "paid" &&
                              projectId ? (
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/projects/${projectId}?tab=expenses&continueSplit=${payment.expense_split_group_id}`}
                                  >
                                    Continue split
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {!payment.expense_split_group_id ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => openEditVendorDialog(payment)}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteVendorTarget(payment)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem disabled>
                                  Managed from Expenses tab
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isClientEditDialogOpen}
        onOpenChange={(open) => {
          setIsClientEditDialogOpen(open)
          if (!open) setEditingClientPayment(null)
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Client Payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Project stage *</Label>
              <Select value={editClientMilestoneId} onValueChange={setEditClientMilestoneId}>
                <SelectTrigger className="w-full bg-muted border-border">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {milestones.map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id}>
                      {milestone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                className="bg-muted border-border"
                value={editClientAmount}
                onChange={(e) => setEditClientAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Received Date (leave empty if pending)</Label>
              <Input
                type="date"
                className="bg-muted border-border"
                value={editClientDate}
                onChange={(e) => setEditClientDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={editClientPaymentMode} onValueChange={setEditClientPaymentMode}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="RTGS">RTGS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                className="bg-muted border-border"
                value={editClientRemarks}
                onChange={(e) => setEditClientRemarks(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsClientEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateClientPayment()} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isVendorEditDialogOpen}
        onOpenChange={(open) => {
          setIsVendorEditDialogOpen(open)
          if (!open) setEditingVendorPayment(null)
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Vendor Payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Vendor Name *</Label>
              <Input
                className="bg-muted border-border"
                value={editVendorName}
                onChange={(e) => setEditVendorName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editVendorCategory} onValueChange={setEditVendorCategory}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Materials">Materials</SelectItem>
                  <SelectItem value="Labour">Labour</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                  <SelectItem value="Transport">Transport</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Amount *</Label>
                <Input
                  type="number"
                  className="bg-muted border-border"
                  value={editVendorTotalAmount}
                  onChange={(e) => setEditVendorTotalAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  className="bg-muted border-border"
                  value={editVendorAmountPaid}
                  onChange={(e) => setEditVendorAmountPaid(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                className="bg-muted border-border"
                value={editVendorDueDate}
                onChange={(e) => setEditVendorDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsVendorEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateVendorPayment()} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteClientTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteClientTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the payment record for{" "}
              <span className="font-medium">{deleteClientTarget?.stage_name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteClientPayment()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteVendorTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteVendorTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vendor payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the payment record for{" "}
              <span className="font-medium">{deleteVendorTarget?.vendor_name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteVendorPayment()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

    <ClientPaymentsPrintSheet
      projectName={project?.name ?? "Project"}
      clientName={project?.client_name ?? "—"}
      siteAddress={project?.site_address}
      contractValue={project ? Number(project.contract_value) : null}
      payments={sortedClientPayments}
      totalReceived={totalReceived}
      totalPending={totalPendingClient}
    />
    </>
  )
}
