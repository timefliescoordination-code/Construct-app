"use client"

import { useRef, useState, useEffect, useMemo } from "react"
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
import { Plus, Upload, Filter, Loader2, Pencil } from "lucide-react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useParams } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import type { ProjectWithDetails } from "@/lib/types/database"
import { milestoneNameById } from "@/lib/project-tab-hydration"
import { createExpenseAction, updateExpenseAction } from "@/lib/projects/tab-actions"
import * as XLSX from "xlsx"

const categories = ["Materials", "Labour", "Equipment", "Miscellaneous"]
const subcategories: Record<string, string[]> = {
  Materials: ["Cement", "Steel", "Sand", "Bricks", "Tiles", "Paint", "Plumbing", "Electrical"],
  Equipment: ["Excavator", "Crane", "Mixer", "Compactor", "Generator"],
  Miscellaneous: ["Transportation", "Permits", "Insurance", "Utilities", "Other"],
}

function isLabourCategory(category: string) {
  return category.trim().toLowerCase() === "labour"
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
  labour_team_id?: string | null
  milestones?: { name: string } | null
}

interface LabourTeamOption {
  id: string
  name: string
}

interface Milestone {
  id: string
  name: string
}

interface ImportDraftRow {
  id: string
  rowNumber: number
  date: string
  category: string
  subcategory: string
  description: string
  vendor: string
  amount: string
  milestone: string
  selected: boolean
}

interface ExpensesTabProps {
  projectId?: string
  project?: ProjectWithDetails
  onProjectChange?: () => void
}

function splitExpenseDescription(full: string): { subcategory: string; description: string } {
  const separator = " - "
  const idx = full.indexOf(separator)
  if (idx === -1) return { subcategory: "", description: full }
  return {
    subcategory: full.slice(0, idx),
    description: full.slice(idx + separator.length),
  }
}

function toExpenseDescription(subcategory: string, description: string) {
  return subcategory ? `${subcategory} - ${description}` : description
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
    labour_team_id: exp.labour_team_id ?? null,
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
  const { canEnterData, canManageProjects } = useAuth()
  
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importDraftRows, setImportDraftRows] = useState<ImportDraftRow[]>([])
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const excelInputRef = useRef<HTMLInputElement | null>(null)
  const [labourTeams, setLabourTeams] = useState<LabourTeamOption[]>([])
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: "",
    subcategory: "",
    labourTeamId: "",
    description: "",
    vendor: "",
    amount: "",
    billNumber: "",
    milestoneId: "",
  })
  const [editExpense, setEditExpense] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    subcategory: "",
    labourTeamId: "",
    description: "",
    vendor: "",
    amount: "",
    billNumber: "",
    milestoneId: "",
    status: "pending",
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

  useEffect(() => {
    if (!projectId) return

    async function fetchLabourTeams() {
      try {
        const res = await fetch(`/api/projects/${projectId}/labour-teams`, {
          credentials: "include",
          cache: "no-store",
        })
        const json = (await res.json().catch(() => ({}))) as {
          data?: { teams: LabourTeamOption[] }
        }
        if (res.ok && json.data?.teams) {
          setLabourTeams(json.data.teams)
        }
      } catch {
        // Non-blocking; labour team dropdown may be empty until migration runs
      }
    }

    void fetchLabourTeams()
  }, [projectId])

  const labourTeamNameById = useMemo(
    () => new Map(labourTeams.map((t) => [t.id, t.name])),
    [labourTeams],
  )

  const resolveLabourTeamId = (
    teamId: string | null | undefined,
    description: string,
  ): string => {
    if (teamId) return teamId
    const { subcategory } = splitExpenseDescription(description)
    const match = labourTeams.find(
      (t) => t.name.toLowerCase() === subcategory.trim().toLowerCase(),
    )
    return match?.id ?? ""
  }

  const handleAddExpense = async () => {
    if (!projectId) {
      toast.error("Project ID not found")
      return
    }
    
    if (!newExpense.category || !newExpense.description || !newExpense.amount) {
      toast.error("Please fill in all required fields")
      return
    }

    if (isLabourCategory(newExpense.category) && !newExpense.labourTeamId) {
      toast.error("Select which labour team received this payment")
      return
    }
    
    setIsSubmitting(true)

    const teamName = labourTeamNameById.get(newExpense.labourTeamId)
    const description = isLabourCategory(newExpense.category)
      ? newExpense.description
      : toExpenseDescription(newExpense.subcategory, newExpense.description)
    const result = await createExpenseAction({
      projectId,
      milestoneId: newExpense.milestoneId || null,
      category: newExpense.category,
      description: teamName ? `${teamName} - ${description}` : description,
      amount: parseFloat(newExpense.amount),
      vendorName: newExpense.vendor || null,
      billNumber: newExpense.billNumber || null,
      expenseDate: newExpense.date,
      labourTeamId: isLabourCategory(newExpense.category)
        ? newExpense.labourTeamId
        : null,
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
        labourTeamId: "",
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

  const openEditExpense = (expense: Expense) => {
    const { subcategory, description } = splitExpenseDescription(expense.description)
    const labourTeamId = resolveLabourTeamId(expense.labour_team_id, expense.description)
    setEditingExpenseId(expense.id)
    setEditExpense({
      date: expense.expense_date,
      category: expense.category,
      subcategory: isLabourCategory(expense.category) ? "" : subcategory,
      labourTeamId,
      description: isLabourCategory(expense.category)
        ? labourTeamId
          ? description
          : expense.description
        : description,
      vendor: expense.vendor_name ?? "",
      amount: String(expense.amount),
      billNumber: expense.bill_number ?? "",
      milestoneId: expense.milestone_id ?? "",
      status: expense.status,
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateExpense = async () => {
    if (!projectId || !editingExpenseId) {
      toast.error("Expense not found")
      return
    }

    if (!editExpense.category || !editExpense.description || !editExpense.amount) {
      toast.error("Please fill in all required fields")
      return
    }

    if (isLabourCategory(editExpense.category) && !editExpense.labourTeamId) {
      toast.error("Select which labour team received this payment")
      return
    }

    setIsSubmitting(true)
    const teamName = labourTeamNameById.get(editExpense.labourTeamId)
    const description = isLabourCategory(editExpense.category)
      ? editExpense.description
      : toExpenseDescription(editExpense.subcategory, editExpense.description)
    const result = await updateExpenseAction({
      projectId,
      expenseId: editingExpenseId,
      milestoneId: editExpense.milestoneId || null,
      category: editExpense.category,
      description: teamName ? `${teamName} - ${description}` : description,
      amount: parseFloat(editExpense.amount),
      vendorName: editExpense.vendor || null,
      billNumber: editExpense.billNumber || null,
      expenseDate: editExpense.date,
      labourTeamId: isLabourCategory(editExpense.category)
        ? editExpense.labourTeamId
        : null,
      status: canManageProjects
        ? (editExpense.status as "approved" | "rejected" | "pending")
        : undefined,
    })

    if (!result.ok) {
      toast.error(result.error)
    } else {
      const row = result.data
      const milestoneId = (row.milestone_id as string | null) ?? null
      const milestoneName =
        milestoneId != null
          ? milestones.find((m) => m.id === milestoneId)?.name ??
            (project ? milestoneNameById(project).get(milestoneId) : undefined)
          : undefined
      toast.success("Expense updated successfully!")
      setExpenses((prev) =>
        prev.map((exp) =>
          exp.id === editingExpenseId
            ? {
                id: exp.id,
                expense_date: row.expense_date as string,
                category: row.category as string,
                description: row.description as string,
                vendor_name: (row.vendor_name as string | null) ?? null,
                amount: Number(row.amount),
                bill_number: (row.bill_number as string | null) ?? null,
                status: row.status as string,
                milestone_id: milestoneId,
                milestones: milestoneName ? { name: milestoneName } : null,
              }
            : exp,
        ),
      )
      onProjectChange?.()
      setIsEditDialogOpen(false)
      setEditingExpenseId(null)
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

  const formatDraftAmount = (value: unknown): string => {
    if (typeof value === "number" && !Number.isNaN(value)) return String(value)
    return String(value ?? "").trim()
  }

  const toIsoDate = (year: number, month: number, day: number): string | null => {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const d = new Date(year, month - 1, day)
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      return null
    }
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const parseExpenseDate = (value: unknown): string => {
    if (typeof value === "number" && value > 0) {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed) {
        const iso = toIsoDate(parsed.y, parsed.m, parsed.d)
        if (iso) return iso
      }
    }

    const text = String(value ?? "").trim()
    if (!text) return format(new Date(), "yyyy-MM-dd")

    const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (isoMatch) {
      const iso = toIsoDate(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3]),
      )
      if (iso) return iso
    }

    // India-style default: dd/mm/yyyy (also handles dd-mm-yyyy, dd.mm.yyyy)
    const dmyMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
    if (dmyMatch) {
      const day = Number(dmyMatch[1])
      const month = Number(dmyMatch[2])
      let year = Number(dmyMatch[3])
      if (year < 100) year += 2000
      const iso = toIsoDate(year, month, day)
      if (iso) return iso
    }

    const serial = Number(text)
    if (!Number.isNaN(serial) && serial > 20000 && serial < 60000) {
      const parsed = XLSX.SSF.parse_date_code(serial)
      if (parsed) {
        const iso = toIsoDate(parsed.y, parsed.m, parsed.d)
        if (iso) return iso
      }
    }

    return format(new Date(), "yyyy-MM-dd")
  }

  const normalizeCategory = (value: string): string => {
    const cleaned = value.trim().toLowerCase()
    if (!cleaned) return ""
    const match = categories.find((cat) => cat.toLowerCase() === cleaned)
    return match ?? value.trim()
  }

  const toggleDraftRowSelection = (
    index: number,
    checked: boolean,
    shiftKey: boolean,
  ) => {
    setImportDraftRows((prev) => {
      const next = [...prev]
      if (shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (let i = start; i <= end; i += 1) {
          next[i] = { ...next[i], selected: checked }
        }
      } else {
        next[index] = { ...next[index], selected: checked }
      }
      return next
    })
    setLastSelectedIndex(index)
  }

  const updateDraftRow = (
    index: number,
    field: keyof Pick<ImportDraftRow, "date" | "category" | "subcategory" | "description" | "vendor" | "amount" | "milestone">,
    value: string,
  ) => {
    setImportDraftRows((prev) => {
      const next = [...prev]
      const target = next[index]
      if (!target) return prev

      // Bulk-edit milestone for all selected rows when editing any selected row's milestone.
      if (field === "milestone" && target.selected) {
        return next.map((row) =>
          row.selected ? { ...row, milestone: value } : row,
        )
      }

      next[index] = { ...target, [field]: value }
      return next
    })
  }

  const importDraftRowsToProject = async () => {
    if (!projectId || importDraftRows.length === 0) return
    setIsImporting(true)
    try {
      const milestoneByName = new Map(
        milestones.map((m) => [m.name.trim().toLowerCase(), m.id]),
      )
      let successCount = 0
      let failedCount = 0
      const failedReasons: string[] = []

      for (const row of importDraftRows) {
        const category = normalizeCategory(row.category)
        const description = row.description.trim()
        const amount = parseAmount(row.amount)
        const milestoneName = row.milestone.trim().toLowerCase()

        if (!category || !description || Number.isNaN(amount) || amount <= 0) {
          failedCount += 1
          failedReasons.push(
            `Row ${row.rowNumber}: missing/invalid category, description, or amount`,
          )
          continue
        }

        const milestoneId = milestoneName ? (milestoneByName.get(milestoneName) ?? null) : null
        if (milestoneName && !milestoneId) {
          failedCount += 1
          failedReasons.push(`Row ${row.rowNumber}: milestone "${row.milestone}" not found`)
          continue
        }

        const subcategory = row.subcategory.trim()
        const labourTeam =
          isLabourCategory(category) && subcategory
            ? labourTeams.find(
                (t) => t.name.toLowerCase() === subcategory.toLowerCase(),
              )
            : undefined

        const result = await createExpenseAction({
          projectId,
          milestoneId,
          category,
          description: isLabourCategory(category)
            ? labourTeam
              ? `${labourTeam.name} - ${description}`
              : description
            : toExpenseDescription(subcategory, description),
          amount,
          vendorName: row.vendor.trim() || null,
          billNumber: null,
          expenseDate: parseExpenseDate(row.date),
          labourTeamId: labourTeam?.id ?? null,
          status: "approved",
        })

        if (result.ok) {
          successCount += 1
        } else {
          failedCount += 1
          failedReasons.push(`Row ${row.rowNumber}: ${result.error}`)
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

      setIsImportDialogOpen(false)
      setImportDraftRows([])
      setLastSelectedIndex(null)
    } finally {
      setIsImporting(false)
    }
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

      const draftRows: ImportDraftRow[] = []
      for (let index = 0; index < rows.length; index += 1) {
        const row = normalizeRow(rows[index])
        draftRows.push({
          id: `${Date.now()}-${index}`,
          rowNumber: index + 2,
          date: parseExpenseDate(row.date),
          category: normalizeCategory(String(row.category ?? "")),
          subcategory: String(row.subcategory ?? "").trim(),
          description: String(row.description ?? "").trim(),
          vendor: String(row.vendor ?? "").trim(),
          amount: formatDraftAmount(row.amount),
          milestone: String(row.milestone ?? "").trim(),
          selected: false,
        })
      }

      setImportDraftRows(draftRows)
      setLastSelectedIndex(null)
      setIsImportDialogOpen(true)
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
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="w-[95vw] max-w-7xl bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Review Import Rows</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Tip: select multiple rows, then change milestone in any selected row to apply to all selected rows. Dates use dd/mm/yyyy from Excel/CSV.
                  </p>
                  <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
                    <Table className="min-w-[1280px] table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead className="w-14">Row</TableHead>
                          <TableHead className="w-36">Date</TableHead>
                          <TableHead className="w-32">Category</TableHead>
                          <TableHead className="w-56">Description</TableHead>
                          <TableHead className="w-36">Vendor</TableHead>
                          <TableHead className="w-28">Amount</TableHead>
                          <TableHead className="w-40">Milestone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importDraftRows.map((row, index) => (
                          <TableRow key={row.id}>
                            <TableCell className="align-top">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={(e) =>
                                  toggleDraftRowSelection(
                                    index,
                                    e.target.checked,
                                    (e.nativeEvent as MouseEvent).shiftKey,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="align-top text-sm">{row.rowNumber}</TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="date"
                                value={row.date}
                                onChange={(e) => updateDraftRow(index, "date", e.target.value)}
                                className="min-w-[9rem] bg-muted border-border"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.category}
                                onChange={(e) => updateDraftRow(index, "category", e.target.value)}
                                className="min-w-[7rem] bg-muted border-border"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.description}
                                onChange={(e) => updateDraftRow(index, "description", e.target.value)}
                                className="min-w-[12rem] bg-muted border-border"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.vendor}
                                onChange={(e) => updateDraftRow(index, "vendor", e.target.value)}
                                className="min-w-[8rem] bg-muted border-border"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.amount}
                                onChange={(e) => updateDraftRow(index, "amount", e.target.value)}
                                className="min-w-[6rem] bg-muted border-border"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.milestone}
                                onChange={(e) => updateDraftRow(index, "milestone", e.target.value)}
                                className="min-w-[9rem] bg-muted border-border"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsImportDialogOpen(false)
                        setImportDraftRows([])
                        setLastSelectedIndex(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => void importDraftRowsToProject()} disabled={isImporting}>
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Import All Rows"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
                          onValueChange={(val) => setNewExpense({
                            ...newExpense,
                            category: val,
                            subcategory: "",
                            labourTeamId: "",
                          })}
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
                        <Label>
                          {isLabourCategory(newExpense.category)
                            ? "Labour team *"
                            : "Subcategory"}
                        </Label>
                        {isLabourCategory(newExpense.category) ? (
                          <Select
                            value={newExpense.labourTeamId}
                            onValueChange={(val) =>
                              setNewExpense({ ...newExpense, labourTeamId: val })
                            }
                          >
                            <SelectTrigger className="bg-muted border-border">
                              <SelectValue placeholder="Which team was paid?" />
                            </SelectTrigger>
                            <SelectContent>
                              {labourTeams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={newExpense.subcategory}
                            onValueChange={(val) =>
                              setNewExpense({ ...newExpense, subcategory: val })
                            }
                            disabled={!newExpense.category}
                          >
                            <SelectTrigger className="bg-muted border-border">
                              <SelectValue placeholder="Select subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              {newExpense.category &&
                                subcategories[newExpense.category]?.map((sub) => (
                                  <SelectItem key={sub} value={sub}>
                                    {sub}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
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
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[600px] bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Edit Expense</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <Input
                          type="date"
                          value={editExpense.date}
                          onChange={(e) => setEditExpense({ ...editExpense, date: e.target.value })}
                          className="bg-muted border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select
                          value={editExpense.category}
                          onValueChange={(val) =>
                            setEditExpense({
                              ...editExpense,
                              category: val,
                              subcategory: "",
                              labourTeamId: "",
                            })
                          }
                        >
                          <SelectTrigger className="bg-muted border-border">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent className="z-[100]">
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>
                          {isLabourCategory(editExpense.category)
                            ? "Labour team *"
                            : "Subcategory"}
                        </Label>
                        {isLabourCategory(editExpense.category) ? (
                          <Select
                            value={editExpense.labourTeamId}
                            onValueChange={(val) =>
                              setEditExpense({ ...editExpense, labourTeamId: val })
                            }
                          >
                            <SelectTrigger className="bg-muted border-border">
                              <SelectValue placeholder="Which team was paid?" />
                            </SelectTrigger>
                            <SelectContent className="z-[100]">
                              {labourTeams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={editExpense.subcategory}
                            onValueChange={(val) =>
                              setEditExpense({ ...editExpense, subcategory: val })
                            }
                            disabled={!editExpense.category}
                          >
                            <SelectTrigger className="bg-muted border-border">
                              <SelectValue placeholder="Select subcategory" />
                            </SelectTrigger>
                            <SelectContent className="z-[100]">
                              {editExpense.category &&
                                subcategories[editExpense.category]?.map((sub) => (
                                  <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Stage/Milestone</Label>
                        <Select
                          value={editExpense.milestoneId}
                          onValueChange={(val) => setEditExpense({ ...editExpense, milestoneId: val })}
                        >
                          <SelectTrigger className="bg-muted border-border">
                            <SelectValue placeholder="Select milestone" />
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
                    </div>
                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea
                        value={editExpense.description}
                        onChange={(e) =>
                          setEditExpense({ ...editExpense, description: e.target.value })
                        }
                        placeholder="Enter expense description..."
                        className="bg-muted border-border"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Vendor</Label>
                        <Input
                          value={editExpense.vendor}
                          onChange={(e) => setEditExpense({ ...editExpense, vendor: e.target.value })}
                          placeholder="Vendor name"
                          className="bg-muted border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount *</Label>
                        <Input
                          type="number"
                          value={editExpense.amount}
                          onChange={(e) => setEditExpense({ ...editExpense, amount: e.target.value })}
                          placeholder="0.00"
                          className="bg-muted border-border"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bill Number</Label>
                        <Input
                          value={editExpense.billNumber}
                          onChange={(e) =>
                            setEditExpense({ ...editExpense, billNumber: e.target.value })
                          }
                          placeholder="INV-001"
                          className="bg-muted border-border"
                        />
                      </div>
                      {canManageProjects && (
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={editExpense.status}
                            onValueChange={(val) => setEditExpense({ ...editExpense, status: val })}
                          >
                            <SelectTrigger className="bg-muted border-border">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="z-[100]">
                              {statuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditDialogOpen(false)
                        setEditingExpenseId(null)
                      }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => void handleUpdateExpense()} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
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
                  {canEnterData && <TableHead className="w-12">Edit</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEnterData ? 8 : 7} className="text-center py-8 text-muted-foreground">
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
                      {canEnterData && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditExpense(expense)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
