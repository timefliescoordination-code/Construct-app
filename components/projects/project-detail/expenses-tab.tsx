"use client"

import { useRef, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Upload, Filter, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useParams } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import type { ProjectWithDetails } from "@/lib/types/database"
import { milestoneNameById } from "@/lib/project-tab-hydration"
import { createExpenseAction } from "@/lib/projects/tab-actions"
import * as XLSX from "xlsx"

const categories = ["Materials", "Labour", "Equipment", "Miscellaneous"]
const subcategories: Record<string, string[]> = {
  Materials: ["Cement", "Steel", "Sand", "Bricks", "Tiles", "Paint", "Plumbing", "Electrical"],
  Labour: ["Mason", "Carpenter", "Painter", "Electrician", "Plumber", "Helper"],
  Equipment: ["Excavator", "Crane", "Mixer", "Compactor", "Generator"],
  Miscellaneous: ["Transportation", "Permits", "Insurance", "Utilities", "Other"],
}
const statuses = ["pending", "approved", "rejected"]

interface Expense {
  id: string
  expense_date: string
  category: string
  description: string
  vendor_name: string | null
  amount: number
  bill_number: string | null
  status: string
  milestone_id: string | null
  milestones?: { name: string } | null
}

interface Milestone {
  id: string
  name: string
}

interface ExpensesTabProps {
  projectId?: string
  project?: ProjectWithDetails
  onProjectChange?: () => void
}

function mapExpensesFromProject(project: ProjectWithDetails): Expense[] {
  const names = milestoneNameById(project)
  return project.expenses.map((exp) => ({
    id: exp.id,
    expense_date: exp.expense_date,
    category: exp.category,
    description: exp.description,
    vendor_name: exp.vendor_name,
    amount: Number(exp.amount),
    bill_number: exp.bill_number,
    status: exp.status,
    milestone_id: exp.milestone_id,
    milestones: exp.milestone_id && names.has(exp.milestone_id)
      ? { name: names.get(exp.milestone_id)! }
      : null,
  }))
}

export function ExpensesTab({
  projectId: propProjectId,
  project,
  onProjectChange,
}: ExpensesTabProps) {
  const params = useParams()
  const projectId = propProjectId || project?.id || (params?.id as string)
  const { canEnterData } = useAuth()
  
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    project ? mapExpensesFromProject(project) : [],
  )
  const [milestones, setMilestones] = useState<Milestone[]>(() =>
    project ? project.milestones.map((m) => ({ id: m.id, name: m.name })) : [],
  )
  const [isLoading, setIsLoading] = useState(!project)
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const excelInputRef = useRef<HTMLInputElement | null>(null)
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: "",
    subcategory: "",
    description: "",
    vendor: "",
    amount: "",
    billNumber: "",
    milestoneId: "",
  })

  useEffect(() => {
    if (project) {
      setExpenses(mapExpensesFromProject(project))
      setMilestones(project.milestones.map((m) => ({ id: m.id, name: m.name })))
      setIsLoading(false)
      return
    }

    async function fetchData() {
      if (!projectId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const supabase = createClient()

        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('*, milestones(name)')
          .eq('project_id', projectId)
          .order('expense_date', { ascending: false })

        if (expensesError) {
          console.error("[expenses-tab] fetch expenses:", expensesError)
          toast.error("Failed to load expenses")
        } else {
          setExpenses(expensesData || [])
        }

        const { data: milestonesData, error: milestonesError } = await supabase
          .from('milestones')
          .select('id, name')
          .eq('project_id', projectId)
          .order('sort_order')

        if (milestonesError) {
          console.error("[expenses-tab] fetch milestones:", milestonesError)
        } else {
          setMilestones(milestonesData || [])
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [projectId, project])

  const handleAddExpense = async () => {
    if (!projectId) {
      toast.error("Project ID not found")
      return
    }
    
    if (!newExpense.category || !newExpense.description || !newExpense.amount) {
      toast.error("Please fill in all required fields")
      return
    }
    
    setIsSubmitting(true)

    const description = `${newExpense.subcategory ? newExpense.subcategory + ' - ' : ''}${newExpense.description}`
    const result = await createExpenseAction({
      projectId,
      milestoneId: newExpense.milestoneId || null,
      category: newExpense.category,
      description,
      amount: parseFloat(newExpense.amount),
      vendorName: newExpense.vendor || null,
      billNumber: newExpense.billNumber || null,
      expenseDate: newExpense.date,
    })

    if (!result.ok) {
      toast.error(result.error)
    } else {
      const row = result.data
      const names = project ? milestoneNameById(project) : new Map<string, string>()
      const milestoneId = (row.milestone_id as string | null) ?? null
      toast.success("Expense added successfully!")
      setExpenses((prev) => [
        {
          id: row.id as string,
          expense_date: row.expense_date as string,
          category: row.category as string,
          description: row.description as string,
          vendor_name: (row.vendor_name as string | null) ?? null,
          amount: Number(row.amount),
          bill_number: (row.bill_number as string | null) ?? null,
          status: row.status as string,
          milestone_id: milestoneId,
          milestones:
            milestoneId && names.has(milestoneId)
              ? { name: names.get(milestoneId)! }
              : null,
        },
        ...prev,
      ])
      onProjectChange?.()
      setNewExpense({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: "",
        subcategory: "",
        description: "",
        vendor: "",
        amount: "",
        billNumber: "",
        milestoneId: "",
      })
      setIsAddDialogOpen(false)
    }

    setIsSubmitting(false)
  }

  const downloadSampleCsv = () => {
    const header =
      "date,category,subcategory,description,vendor,amount,milestone,status"
    const sampleRows = [
      "2026-05-01,Materials,Cement,OPC 53 grade bags,ABC Traders,25000,Foundation,pending",
      "2026-05-02,Labour,Mason,Masonry work day shift,,12000,,Plinth,approved",
    ]
    const csv = [header, ...sampleRows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "expenses-import-sample.csv"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const toExpenseDescription = (subcategory: string, description: string) =>
    subcategory ? `${subcategory} - ${description}` : description

  const normalizeRow = (row: Record<string, unknown>) => {
    const normalized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase().replace(/\s+/g, "_")] = value
    }
    return normalized
  }

  const parseAmount = (value: unknown): number => {
    if (typeof value === "number") return value
    const cleaned = String(value ?? "")
      .replace(/[₹,\s]/g, "")
      .trim()
    return Number(cleaned)
  }

  const parseExpenseDate = (value: unknown): string => {
    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed) {
        const jsDate = new Date(parsed.y, parsed.m - 1, parsed.d)
        return format(jsDate, "yyyy-MM-dd")
      }
    }

    const text = String(value ?? "").trim()
    if (!text) return format(new Date(), "yyyy-MM-dd")

    const normalized = text.replace(/\./g, "/").replace(/-/g, "/")
    const parts = normalized.split("/")
    if (parts.length === 3) {
      const [a, b, c] = parts.map((p) => p.trim())
      // Handles dd/mm/yyyy and mm/dd/yyyy by preferring day-first if >12.
      const first = Number(a)
      const second = Number(b)
      const year = Number(c.length === 2 ? `20${c}` : c)
      if (!Number.isNaN(first) && !Number.isNaN(second) && !Number.isNaN(year)) {
        const day = first > 12 ? first : second
        const month = first > 12 ? second : first
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const jsDate = new Date(year, month - 1, day)
          return format(jsDate, "yyyy-MM-dd")
        }
      }
    }

    const nativeDate = new Date(text)
    if (!Number.isNaN(nativeDate.getTime())) {
      return format(nativeDate, "yyyy-MM-dd")
    }

    return format(new Date(), "yyyy-MM-dd")
  }

  const normalizeCategory = (value: string): string => {
    const cleaned = value.trim().toLowerCase()
    if (!cleaned) return ""
    const match = categories.find((cat) => cat.toLowerCase() === cleaned)
    return match ?? value.trim()
  }

  const handleImportFile = async (file: File | null) => {
    if (!file || !projectId) return

    setIsImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const firstSheet = workbook.SheetNames[0]
      if (!firstSheet) {
        toast.error("File has no sheets to import.")
        return
      }

      const sheet = workbook.Sheets[firstSheet]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: true,
      })

      if (rows.length === 0) {
        toast.error("No rows found in the selected file.")
        return
      }

      const milestoneByName = new Map(
        milestones.map((m) => [m.name.trim().toLowerCase(), m.id]),
      )

      let successCount = 0
      let failedCount = 0
      const failedReasons: string[] = []

      for (let index = 0; index < rows.length; index += 1) {
        const row = normalizeRow(rows[index])
        const date = parseExpenseDate(row.date)
        const category = normalizeCategory(String(row.category ?? ""))
        const subcategory = String(row.subcategory ?? "").trim()
        const description = String(row.description ?? "").trim()
        const vendor = String(row.vendor ?? "").trim()
        const amount = parseAmount(row.amount)
        const milestoneName = String(row.milestone ?? "").trim().toLowerCase()

        if (!category || !description || Number.isNaN(amount) || amount <= 0) {
          failedCount += 1
          failedReasons.push(
            `Row ${index + 2}: missing/invalid category, description, or amount`,
          )
          continue
        }

        const milestoneId = milestoneName ? (milestoneByName.get(milestoneName) ?? null) : null
        if (milestoneName && !milestoneId) {
          failedCount += 1
          failedReasons.push(`Row ${index + 2}: milestone "${milestoneName}" not found`)
          continue
        }

        const result = await createExpenseAction({
          projectId,
          milestoneId,
          category,
          description: toExpenseDescription(subcategory, description),
          amount,
          vendorName: vendor || null,
          billNumber: null,
          expenseDate: date || format(new Date(), "yyyy-MM-dd"),
          status: "approved",
        })

        if (result.ok) {
          successCount += 1
        } else {
          failedCount += 1
          failedReasons.push(`Row ${index + 2}: ${result.error}`)
        }
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} expense(s).`)
        onProjectChange?.()
        const supabase = createClient()
        const { data: refreshed } = await supabase
          .from("expenses")
          .select("*, milestones(name)")
          .eq("project_id", projectId)
          .order("expense_date", { ascending: false })
        setExpenses((refreshed ?? []) as Expense[])
      }

      if (failedCount > 0) {
        const preview = failedReasons.slice(0, 3).join(" | ")
        toast.warning(
          `${failedCount} row(s) were skipped. ${preview || "Check required fields and milestone names."}`,
        )
      }
    } catch (error) {
      console.error("[expenses-tab] import error:", error)
      toast.error("Failed to import file. Check format and try again.")
    } finally {
      setIsImporting(false)
      if (csvInputRef.current) csvInputRef.current.value = ""
      if (excelInputRef.current) excelInputRef.current.value = ""
    }
  }

  const filteredExpenses = expenses.filter((expense) => {
    if (filterCategory !== "all" && expense.category !== filterCategory) return false
    if (filterStatus !== "all" && expense.status !== filterStatus) return false
    return true
  })

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Approved</Badge>
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pending</Badge>
      case "rejected":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Manage Expenses Table - Primary Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <CardTitle>Manage Expenses</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
              />
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2" disabled={isImporting}>
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Import / Sample
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => csvInputRef.current?.click()}>
                    Import as .csv
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => excelInputRef.current?.click()}>
                    Import as .excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadSampleCsv}>
                    Download sample .csv
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[150px] bg-muted border-border">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] bg-muted border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Add New Expense</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <Input 
                          type="date" 
                          value={newExpense.date}
                          onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                          className="bg-muted border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select 
                          value={newExpense.category}
                          onValueChange={(val) => setNewExpense({...newExpense, category: val, subcategory: ""})}
                        >
                          <SelectTrigger className="bg-muted border-border">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Subcategory</Label>
                        <Select 
                          value={newExpense.subcategory}
                          onValueChange={(val) => setNewExpense({...newExpense, subcategory: val})}
                          disabled={!newExpense.category}
                        >
                          <SelectTrigger className="bg-muted border-border">
                            <SelectValue placeholder="Select subcategory" />
                          </SelectTrigger>
                          <SelectContent>
                            {newExpense.category && subcategories[newExpense.category]?.map((sub) => (
                              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Stage/Milestone</Label>
                        <Select 
                          value={newExpense.milestoneId}
                          onValueChange={(val) => setNewExpense({...newExpense, milestoneId: val})}
                        >
                          <SelectTrigger className="bg-muted border-border">
                            <SelectValue placeholder="Select milestone" />
                          </SelectTrigger>
                          <SelectContent>
                            {milestones.map((milestone) => (
                              <SelectItem key={milestone.id} value={milestone.id}>{milestone.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea 
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                        placeholder="Enter expense description..."
                        className="bg-muted border-border"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Vendor</Label>
                        <Input 
                          value={newExpense.vendor}
                          onChange={(e) => setNewExpense({...newExpense, vendor: e.target.value})}
                          placeholder="Vendor name"
                          className="bg-muted border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount *</Label>
                        <Input 
                          type="number"
                          value={newExpense.amount}
                          onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                          placeholder="0.00"
                          className="bg-muted border-border"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bill Number</Label>
                        <Input 
                          value={newExpense.billNumber}
                          onChange={(e) => setNewExpense({...newExpense, billNumber: e.target.value})}
                          placeholder="INV-001"
                          className="bg-muted border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bill Upload</Label>
                        <Button variant="outline" className="w-full gap-2 bg-muted border-border">
                          <Upload className="h-4 w-4" />
                          Upload Bill
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddExpense} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Expense"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No expenses found. Click "Add Expense" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense) => (
                    <TableRow key={expense.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {format(new Date(expense.expense_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{expense.category}</p>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell>{expense.vendor_name || '-'}</TableCell>
                      <TableCell>
                        {expense.milestones?.name ? (
                          <Badge variant="outline" className="bg-muted">
                            {expense.milestones.name}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        Rs {Number(expense.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses (Filtered)</p>
              <p className="text-2xl font-bold">Rs {totalExpenses.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Entries</p>
              <p className="text-2xl font-bold">{filteredExpenses.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
