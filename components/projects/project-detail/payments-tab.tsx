"use client"

import { useState, useEffect } from "react"
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
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"

interface ClientPayment {
  id: string
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
}

interface PaymentsTabProps {
  projectId?: string
}

export function PaymentsTab({ projectId: propProjectId }: PaymentsTabProps = {}) {
  const params = useParams()
  const projectId = propProjectId || (params?.id as string)
  const { user, canEnterData } = useAuth()
  
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([])
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Client payment form state
  const [clientAmount, setClientAmount] = useState("")
  const [clientDate, setClientDate] = useState("")
  const [clientPaymentMode, setClientPaymentMode] = useState("")
  const [clientRemarks, setClientRemarks] = useState("")
  const [clientStageName, setClientStageName] = useState("")
  
  // Vendor payment form state
  const [vendorName, setVendorName] = useState("")
  const [vendorTotalAmount, setVendorTotalAmount] = useState("")
  const [vendorAmountPaid, setVendorAmountPaid] = useState("")
  const [vendorDueDate, setVendorDueDate] = useState("")
  const [vendorCategory, setVendorCategory] = useState("")

  useEffect(() => {
    fetchPayments()
  }, [projectId])

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
        .order('due_date', { ascending: true })
      
      if (clientError) throw clientError
      setClientPayments(clientData || [])
      
      // Fetch vendor payments
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_payments')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true })
      
      if (vendorError) throw vendorError
      setVendorPayments(vendorData || [])
    } catch (error: any) {
      console.error("[v0] Error fetching payments:", error)
      toast.error(`Failed to load payments: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddClientPayment = async () => {
    if (!clientAmount || !clientStageName) {
      toast.error("Please fill in required fields (Stage Name and Amount)")
      return
    }
    
    setIsSubmitting(true)
    const supabase = createClient()
    
    try {
      const paymentData = {
        project_id: projectId,
        stage_name: clientStageName,
        amount: parseFloat(clientAmount),
        received_date: clientDate || null,
        status: clientDate ? 'received' : 'pending',
        payment_method: clientPaymentMode || null,
        notes: clientRemarks || null,
        entered_by: user?.id || null,
      }
      
      const { data, error } = await supabase
        .from('client_payments')
        .insert(paymentData)
        .select()
        .single()
      
      if (error) throw error
      
      setClientPayments(prev => [...prev, data])
      toast.success("Client payment added successfully")
      
      // Reset form
      setClientAmount("")
      setClientDate("")
      setClientPaymentMode("")
      setClientRemarks("")
      setClientStageName("")
      setIsClientDialogOpen(false)
    } catch (error: any) {
      console.error("[v0] Error adding client payment:", error)
      toast.error(`Failed to add payment: ${error.message}`)
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
    const supabase = createClient()
    
    try {
      const amountPaid = parseFloat(vendorAmountPaid) || 0
      const totalAmount = parseFloat(vendorTotalAmount)
      
      let status = 'pending'
      if (amountPaid >= totalAmount) {
        status = 'paid'
      } else if (amountPaid > 0) {
        status = 'partial'
      }
      
      const paymentData = {
        project_id: projectId,
        vendor_name: vendorName,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        due_date: vendorDueDate || null,
        status: status,
        category: vendorCategory || null,
        entered_by: user?.id || null,
      }
      
      const { data, error } = await supabase
        .from('vendor_payments')
        .insert(paymentData)
        .select()
        .single()
      
      if (error) throw error
      
      setVendorPayments(prev => [...prev, data])
      toast.success("Vendor payment added successfully")
      
      // Reset form
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

  const totalReceived = clientPayments
    .filter(p => p.status === 'received')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPaid = vendorPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const totalPending = vendorPayments.reduce((sum, p) => sum + Number(p.pending_amount || 0), 0)
  const netCashPosition = totalReceived - totalPaid - totalPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cashflow Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Rs {totalReceived.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From client</p>
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
          <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Record Client Payment</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Stage/Milestone Name *</Label>
                  <Input 
                    placeholder="e.g., Foundation Completion" 
                    className="bg-muted border-border"
                    value={clientStageName}
                    onChange={(e) => setClientStageName(e.target.value)}
                  />
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
                    <SelectContent>
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
                <Button onClick={handleAddClientPayment} disabled={isSubmitting}>
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
                  <TableHead>Stage</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No client payments recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  clientPayments.map((payment) => (
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
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Payment
              </Button>
            </DialogTrigger>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No vendor payments recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  vendorPayments.map((payment) => (
                    <TableRow key={payment.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium">{payment.vendor_name}</TableCell>
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
