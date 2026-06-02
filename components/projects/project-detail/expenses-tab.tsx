"use client"

import {
  Fragment,
  useRef,
  useState,
  useEffect,
  useMemo,
  startTransition,
  type ChangeEvent,
} from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Upload, Filter, Loader2, Pencil, Split, FileText, ExternalLink, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useParams, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import type {
  ExpenseInvoiceWithItems,
  InvoiceItem,
  ProjectWithDetails,
} from "@/lib/types/database"
import { formatINR } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { milestoneNameById } from "@/lib/project-tab-hydration"
import {
  bulkCreateExpensesAction,
  createExpenseAction,
  syncProjectMilestoneMetricsAction,
  updateExpenseAction,
  updateExpenseStatusAction,
} from "@/lib/projects/tab-actions"
import {
  attachExpenseInvoiceFromBrowser,
  replaceExpenseInvoiceFromBrowser,
} from "@/lib/invoices/client-attach"
import {
  deleteExpenseInvoiceAction,
  triggerExpenseInvoiceProcessingAction,
} from "@/lib/projects/invoice-actions"
import { validateInvoiceFile } from "@/lib/invoices/validate"
import { formatFileSize } from "@/lib/file-upload"
import {
  createExpenseSplitGroupAction,
  listOpenSplitGroupsAction,
  type OpenSplitGroupSummary,
} from "@/lib/projects/expense-split-actions"
import type { ExpenseCategoryView } from "@/lib/data/expense-categories"
import { ExpenseCategoryManageDialog } from "@/components/projects/project-detail/expense-category-manage-dialog"
import { ExpenseSplitGroupDialog } from "@/components/projects/project-detail/expense-split-group-dialog"
import { PendingSplitSuggestion } from "@/components/projects/project-detail/pending-split-suggestion"
import {
  ExpenseBulkToolbar,
  ExpenseRowCheckbox,
  ExpenseSelectAllCheckbox,
} from "@/components/projects/project-detail/expense-bulk-toolbar"
import { ExpenseCategorySummary } from "@/components/projects/project-detail/expense-category-summary"
import { ProjectFinancialSummary } from "@/components/projects/project-detail/project-financial-summary"
import {
  findMatchingOpenSplitGroup,
  getSplitPaymentStatus,
  validateInitialSplitCreate,
  type SplitPaymentDisplayStatus,
} from "@/lib/expense-splits/calculations"
import * as XLSX from "xlsx"

function categoryUsesLabourTeams(
  categoryName: string,
  categories: ExpenseCategoryView[],
) {
  const match = categories.find((c) => c.name === categoryName)
  if (match) return match.usesLabourTeams
  return categoryName.trim().toLowerCase() === "labour"
}
const statuses = ["pending", "approved", "rejected"]
const EXPENSE_LIST_PREVIEW_LIMIT = 15
const EXPENSE_DIALOG_CLASS =
  "flex max-h-[min(92dvh,100dvh)] flex-col gap-0 overflow-hidden border-border bg-card p-0 sm:max-w-[600px]"
const EXPENSE_FORM_ROW = "grid grid-cols-1 gap-4 sm:grid-cols-2"

type ExpenseInvoiceDetailsState = {
  loading: boolean
  data?: ExpenseInvoiceWithItems
  viewUrl?: string | null
  error?: string
}

type ExpenseInvoiceAttachmentHint = {
  fileName: string
  viewUrl: string
}

function isInvoiceImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/")
}

function formatInvoiceLineQuantity(item: InvoiceItem): string {
  const quantity =
    item.quantity == null ? null : Number(item.quantity).toLocaleString("en-IN")
  const unit = item.unit?.trim()

  if (quantity && unit) return `${quantity} ${unit}`
  if (quantity) return quantity
  if (unit) return unit
  return "—"
}

async function fetchExpenseIdsWithInvoices(projectId: string): Promise<Set<string>> {
  try {
    const response = await fetch(`/api/projects/${projectId}/expense-invoices`, {
      credentials: "include",
      cache: "no-store",
    })
    const json = (await response.json().catch(() => ({}))) as {
      data?: { expenseIds?: string[] }
      error?: string
    }

    if (!response.ok) {
      if (json.error) {
        console.error("[expenses-tab] fetch invoice flags:", json.error)
      }
      return new Set()
    }

    return new Set(json.data?.expenseIds ?? [])
  } catch (error) {
    console.error("[expenses-tab] fetch invoice flags:", error)
    return new Set()
  }
}

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
  split_group_id?: string | null
  split_number?: number | null
  split_total_amount?: number | null
  split_group_subcategory_name?: string | null
  split_group_labour_team_id?: string | null
  milestones?: { name: string } | null
}

function mapExpenseRow(row: Record<string, unknown>): Expense {
  const groupRaw = row.expense_split_groups
  const group =
    groupRaw && typeof groupRaw === "object" && !Array.isArray(groupRaw)
      ? (groupRaw as {
          total_amount: number
          subcategory_name?: string | null
          labour_team_id?: string | null
        })
      : null

  return {
    id: row.id as string,
    expense_date: row.expense_date as string,
    category: row.category as string,
    description: row.description as string,
    vendor_name: (row.vendor_name as string | null) ?? null,
    amount: Number(row.amount),
    bill_number: (row.bill_number as string | null) ?? null,
    status: row.status as string,
    milestone_id: (row.milestone_id as string | null) ?? null,
    labour_team_id: (row.labour_team_id as string | null) ?? null,
    split_group_id: (row.split_group_id as string | null) ?? null,
    split_number: (row.split_number as number | null) ?? null,
    split_total_amount: group ? Number(group.total_amount) : null,
    split_group_subcategory_name: group?.subcategory_name ?? null,
    split_group_labour_team_id: group?.labour_team_id ?? null,
    milestones: row.milestones as { name: string } | null,
  }
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

/** Rows per server request — keeps each action under hosting time limits. */
const IMPORT_SERVER_CHUNK_SIZE = 50

type ImportProgressState = {
  phase: "idle" | "preparing" | "importing" | "syncing" | "refreshing"
  current: number
  total: number
  chunk: number
  chunkCount: number
  message: string
} | null

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
    split_group_id: exp.split_group_id ?? null,
    split_number: exp.split_number ?? null,
    split_total_amount: null,
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
  const [showAllExpenses, setShowAllExpenses] = useState(false)
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [isParsingImportFile, setIsParsingImportFile] = useState(false)
  const [isCommittingImport, setIsCommittingImport] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgressState>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importDraftRows, setImportDraftRows] = useState<ImportDraftRow[]>([])
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const excelInputRef = useRef<HTMLInputElement | null>(null)
  const [labourTeams, setLabourTeams] = useState<LabourTeamOption[]>([])
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryView[]>([])
  const [categoryManageOpen, setCategoryManageOpen] = useState(false)
  const [subcategoryManageOpen, setSubcategoryManageOpen] = useState(false)
  const [manageMode, setManageMode] = useState<"subcategories" | "labour-teams">(
    "subcategories",
  )
  const searchParams = useSearchParams()
  const [splitMode, setSplitMode] = useState(false)
  const [splitFirstAmount, setSplitFirstAmount] = useState("")
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const invoiceFileInputRef = useRef<HTMLInputElement>(null)
  const [expenseIdsWithInvoice, setExpenseIdsWithInvoice] = useState<Set<string>>(
    () => new Set(),
  )
  const [expandedInvoiceExpenseIds, setExpandedInvoiceExpenseIds] = useState<
    Set<string>
  >(() => new Set())
  const [invoiceDetailsByExpenseId, setInvoiceDetailsByExpenseId] = useState<
    Record<string, ExpenseInvoiceDetailsState>
  >({})
  const [invoiceReplaceFileByExpenseId, setInvoiceReplaceFileByExpenseId] = useState<
    Record<string, File | null>
  >({})
  const [invoiceDeleteConfirmExpenseId, setInvoiceDeleteConfirmExpenseId] = useState<
    string | null
  >(null)
  const [invoiceDeletingExpenseId, setInvoiceDeletingExpenseId] = useState<string | null>(
    null,
  )
  const [invoiceReplacingExpenseId, setInvoiceReplacingExpenseId] = useState<string | null>(
    null,
  )
  const [uploadingInvoiceExpenseIds, setUploadingInvoiceExpenseIds] = useState<
    Set<string>
  >(() => new Set())
  const [invoiceAttachmentByExpenseId, setInvoiceAttachmentByExpenseId] = useState<
    Record<string, ExpenseInvoiceAttachmentHint>
  >({})
  const invoiceAttachmentBlobUrlsRef = useRef<Set<string>>(new Set())
  const invoiceReplaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [splitGroupEditId, setSplitGroupEditId] = useState<string | null>(null)
  const [openSplitGroups, setOpenSplitGroups] = useState<OpenSplitGroupSummary[]>([])
  const [loadingOpenSplits, setLoadingOpenSplits] = useState(false)
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
    const blobUrls = invoiceAttachmentBlobUrlsRef.current
    return () => {
      for (const url of blobUrls) {
        URL.revokeObjectURL(url)
      }
      blobUrls.clear()
    }
  }, [])

  const setImmediateInvoiceAttachment = (expenseIds: string[], file: File) => {
    const viewUrl = URL.createObjectURL(file)
    invoiceAttachmentBlobUrlsRef.current.add(viewUrl)

    setInvoiceAttachmentByExpenseId((prev) => {
      const next = { ...prev }
      for (const id of expenseIds) {
        const existing = prev[id]
        if (existing?.viewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(existing.viewUrl)
          invoiceAttachmentBlobUrlsRef.current.delete(existing.viewUrl)
        }
        next[id] = { fileName: file.name, viewUrl }
      }
      return next
    })
  }

  const clearImmediateInvoiceAttachment = (expenseIds: string[]) => {
    setInvoiceAttachmentByExpenseId((prev) => {
      const next = { ...prev }
      for (const id of expenseIds) {
        const existing = next[id]
        if (existing?.viewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(existing.viewUrl)
          invoiceAttachmentBlobUrlsRef.current.delete(existing.viewUrl)
        }
        delete next[id]
      }
      return next
    })
  }

  useEffect(() => {
    if (project) {
      setMilestones(project.milestones.map((m) => ({ id: m.id, name: m.name })))
      setIsLoading(false)
      if (projectId) {
        void refreshExpensesWithJoin()
      } else {
        setExpenses(mapExpensesFromProject(project))
      }
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
          .select(
            '*, milestones(name), expense_split_groups(total_amount, subcategory_name, labour_team_id)',
          )
          .eq('project_id', projectId)
          .order('expense_date', { ascending: false })

        if (expensesError) {
          console.error("[expenses-tab] fetch expenses:", expensesError)
          toast.error("Failed to load expenses")
        } else {
          const mapped = (expensesData ?? []).map((row) =>
            mapExpenseRow(row as Record<string, unknown>),
          )
          setExpenses(mapped)
          const invoiceIds = await fetchExpenseIdsWithInvoices(projectId)
          setExpenseIdsWithInvoice(invoiceIds)
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
  }, [projectId, project?.id])

  const reloadExpenseOptions = async () => {
    if (!projectId) return
    try {
      const [teamsRes, categoriesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/labour-teams`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/projects/${projectId}/expense-categories`, {
          credentials: "include",
          cache: "no-store",
        }),
      ])
      const teamsJson = (await teamsRes.json().catch(() => ({}))) as {
        data?: { teams: LabourTeamOption[] }
      }
      if (teamsRes.ok && teamsJson.data?.teams) {
        setLabourTeams(teamsJson.data.teams)
      }
      const categoriesJson = (await categoriesRes.json().catch(() => ({}))) as {
        data?: { categories: ExpenseCategoryView[] }
      }
      if (categoriesRes.ok && categoriesJson.data?.categories) {
        setExpenseCategories(categoriesJson.data.categories)
      }
    } catch {
      // Non-blocking until migrations are applied
    }
  }

  useEffect(() => {
    void reloadExpenseOptions()
  }, [projectId])

  useEffect(() => {
    const continueId = searchParams.get("continueSplit")
    if (continueId) {
      setSplitGroupEditId(continueId)
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setIsAddDialogOpen(true)
    }
  }, [searchParams])

  const labourTeamNameById = useMemo(
    () => new Map(labourTeams.map((t) => [t.id, t.name])),
    [labourTeams],
  )

  const categoryNames = useMemo(
    () => expenseCategories.map((c) => c.name),
    [expenseCategories],
  )

  const subcategoriesForCategory = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const cat of expenseCategories) {
      map.set(
        cat.name,
        cat.subcategories.map((s) => s.name),
      )
    }
    return map
  }, [expenseCategories])

  const splitPaymentByGroupId = useMemo(() => {
    const byGroup = new Map<string, Expense[]>()
    for (const exp of expenses) {
      if (!exp.split_group_id) continue
      const list = byGroup.get(exp.split_group_id) ?? []
      list.push(exp)
      byGroup.set(exp.split_group_id, list)
    }
    const statusMap = new Map<string, SplitPaymentDisplayStatus>()
    for (const [groupId, splits] of byGroup) {
      const total =
        splits[0]?.split_total_amount ??
        splits.reduce((sum, s) => sum + Number(s.amount), 0)
      statusMap.set(groupId, getSplitPaymentStatus(total, splits))
    }
    return statusMap
  }, [expenses])

  const suggestedSplitGroup = useMemo(() => {
    const match = findMatchingOpenSplitGroup(openSplitGroups, {
      category: newExpense.category,
      subcategory: newExpense.subcategory,
      labourTeamId: newExpense.labourTeamId,
    })
    if (!match) return null

    const remaining = match.total - match.recorded
    return {
      groupId: match.groupId,
      total: match.total,
      recorded: match.recorded,
      remaining,
      vendor: match.vendor_name,
      splitCount: match.splitCount,
      category: match.category,
      teamLabel: newExpense.labourTeamId
        ? labourTeamNameById.get(newExpense.labourTeamId) ?? "Labour team"
        : newExpense.subcategory,
    }
  }, [
    newExpense.category,
    newExpense.subcategory,
    newExpense.labourTeamId,
    openSplitGroups,
    labourTeamNameById,
  ])

  const handleUseSuggestedSplit = () => {
    if (!suggestedSplitGroup) return
    setIsAddDialogOpen(false)
    resetNewExpenseForm()
    setSplitGroupEditId(suggestedSplitGroup.groupId)
  }

  const loadOpenSplitGroups = async () => {
    if (!projectId) return
    setLoadingOpenSplits(true)
    const result = await listOpenSplitGroupsAction(projectId)
    setLoadingOpenSplits(false)
    if (!result.ok) {
      console.error("[expenses-tab] load split groups:", result.error)
      setOpenSplitGroups([])
      return
    }
    setOpenSplitGroups(result.data)
  }

  const EXPENSE_LIST_SELECT =
    "*, milestones(name), expense_split_groups(total_amount, subcategory_name, labour_team_id)"

  const refreshExpensesListOnly = async () => {
    if (!projectId) return false
    const supabase = createClient()
    const { data, error } = await supabase
      .from("expenses")
      .select(EXPENSE_LIST_SELECT)
      .eq("project_id", projectId)
      .order("expense_date", { ascending: false })

    if (error) {
      console.error("[expenses-tab] refresh expenses:", error)
      return false
    }

    setExpenses(
      (data ?? []).map((row) => mapExpenseRow(row as Record<string, unknown>)),
    )
    return true
  }

  const refreshExpensesWithJoin = async () => {
    if (!projectId) return
    const ok = await refreshExpensesListOnly()
    if (!ok) return
    const invoiceIds = await fetchExpenseIdsWithInvoices(projectId)
    setExpenseIdsWithInvoice((prev) => new Set([...prev, ...invoiceIds]))
    await loadOpenSplitGroups()
    onProjectChange?.()
  }

  const refreshExpensesAfterImport = () => {
    void (async () => {
      await refreshExpensesListOnly()
      void loadOpenSplitGroups()
      onProjectChange?.()
    })()
  }

  const refreshExpenses = refreshExpensesWithJoin

  const IMPORT_PREVIEW_ROW_LIMIT = 80

  useEffect(() => {
    if (isAddDialogOpen && projectId) {
      void loadOpenSplitGroups()
      void refreshExpensesWithJoin()
    }
  }, [isAddDialogOpen, projectId])

  useEffect(() => {
    if (!isAddDialogOpen || !projectId) return
    if (!newExpense.category) return
    if (!newExpense.labourTeamId && !newExpense.subcategory) return
    void loadOpenSplitGroups()
  }, [
    isAddDialogOpen,
    projectId,
    newExpense.category,
    newExpense.subcategory,
    newExpense.labourTeamId,
  ])

  const openSubcategoryManage = () => {
    if (categoryUsesLabourTeams(newExpense.category, expenseCategories)) {
      setManageMode("labour-teams")
    } else {
      setManageMode("subcategories")
    }
    setSubcategoryManageOpen(true)
  }

  const resetNewExpenseForm = () => {
    setNewExpense({
      date: format(new Date(), "yyyy-MM-dd"),
      category: "",
      subcategory: "",
      labourTeamId: "",
      description: "",
      vendor: "",
      amount: "",
      billNumber: "",
      milestoneId: "",
    })
    setSplitMode(false)
    setSplitFirstAmount("")
    setInvoiceFile(null)
    if (invoiceFileInputRef.current) {
      invoiceFileInputRef.current.value = ""
    }
  }

  const handleInvoiceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setInvoiceFile(null)
      return
    }

    const validation = validateInvoiceFile(file)
    if (!validation.valid) {
      toast.error(validation.error ?? "Invalid invoice file.")
      event.target.value = ""
      setInvoiceFile(null)
      return
    }

    setInvoiceFile(file)
  }

  const attachInvoiceToExpense = async (expenseId: string, file: File) => {
    if (!projectId) {
      return { ok: false as const, error: "Project ID is required." }
    }

    const supabase = createClient()
    const { data, error } = await attachExpenseInvoiceFromBrowser(supabase, {
      projectId,
      expenseId,
      file,
    })

    if (error || !data) {
      return { ok: false as const, error: error ?? "Failed to store invoice." }
    }

    void triggerExpenseInvoiceProcessingAction(data.id)

    return { ok: true as const, data }
  }

  const uploadInvoiceInBackground = async (
    expenseId: string,
    file: File,
    linkedExpenseIds?: string[],
  ) => {
    const idsToMark = linkedExpenseIds?.length ? linkedExpenseIds : [expenseId]
    setUploadingInvoiceExpenseIds((prev) => {
      const next = new Set(prev)
      for (const id of idsToMark) next.add(id)
      return next
    })
    try {
      const result = await attachInvoiceToExpense(expenseId, file)
      if (!result.ok) {
        toast.warning(`Invoice upload failed: ${result.error}`)
        return
      }

      setExpenseIdsWithInvoice((prev) => {
        const next = new Set(prev)
        for (const id of idsToMark) next.add(id)
        return next
      })
      setImmediateInvoiceAttachment(idsToMark, file)
      toast.success("Invoice uploaded. Extracting line items…")
    } finally {
      setUploadingInvoiceExpenseIds((prev) => {
        const next = new Set(prev)
        for (const id of idsToMark) next.delete(id)
        return next
      })
    }
  }

  const loadInvoiceDetails = async (expenseId: string) => {
    if (!projectId) return

    setInvoiceDetailsByExpenseId((prev) => ({
      ...prev,
      [expenseId]: { ...prev[expenseId], loading: true, error: undefined },
    }))

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 20000)

      const response = await fetch(
        `/api/projects/${projectId}/expenses/${expenseId}/invoice`,
        {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        },
      )
      window.clearTimeout(timeout)

      const json = (await response.json().catch(() => ({}))) as {
        data?: {
          invoice: ExpenseInvoiceWithItems
          viewUrl: string | null
        }
        error?: string
      }

      if (!response.ok || !json.data) {
        const message = json.error ?? "Failed to load invoice details."
        if (message.includes("No invoice found")) {
          setExpenseIdsWithInvoice((prev) => {
            const next = new Set(prev)
            next.delete(expenseId)
            return next
          })
        }
        setInvoiceDetailsByExpenseId((prev) => ({
          ...prev,
          [expenseId]: { loading: false, error: message },
        }))
        return
      }

      setExpenseIdsWithInvoice((prev) => new Set(prev).add(expenseId))
      setInvoiceDetailsByExpenseId((prev) => ({
        ...prev,
        [expenseId]: {
          loading: false,
          viewUrl: json.data?.viewUrl ?? null,
          data: json.data?.invoice,
        },
      }))
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Loading invoice details timed out. Try again."
          : "Failed to load invoice details."
      setInvoiceDetailsByExpenseId((prev) => ({
        ...prev,
        [expenseId]: { loading: false, error: message },
      }))
    }
  }

  const collapseInvoiceDetails = (expenseId: string) => {
    setExpandedInvoiceExpenseIds((prev) => {
      const next = new Set(prev)
      next.delete(expenseId)
      return next
    })
  }

  const handleInvoiceReplaceFileChange = (
    expenseId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      setInvoiceReplaceFileByExpenseId((prev) => ({ ...prev, [expenseId]: null }))
      return
    }

    const validation = validateInvoiceFile(file)
    if (!validation.valid) {
      toast.error(validation.error ?? "Invalid invoice file.")
      event.target.value = ""
      setInvoiceReplaceFileByExpenseId((prev) => ({ ...prev, [expenseId]: null }))
      return
    }

    setInvoiceReplaceFileByExpenseId((prev) => ({ ...prev, [expenseId]: file }))
  }

  const handleReplaceInvoice = async (expenseId: string) => {
    if (!projectId) return

    const file = invoiceReplaceFileByExpenseId[expenseId]
    if (!file) {
      toast.error("Choose a replacement invoice file first.")
      return
    }

    setInvoiceReplacingExpenseId(expenseId)
    const supabase = createClient()
    const { data, error } = await replaceExpenseInvoiceFromBrowser(supabase, {
      projectId,
      expenseId,
      file,
    })

    if (error || !data) {
      setInvoiceReplacingExpenseId(null)
      toast.error(error ?? "Failed to replace invoice.")
      return
    }

    const trigger = await triggerExpenseInvoiceProcessingAction(data.id)
    setInvoiceReplacingExpenseId(null)

    if (!trigger.ok) {
      toast.error(trigger.error ?? "Invoice replaced but processing could not start.")
      return
    }

    toast.success("Invoice replaced. Extracting line items…")
    setImmediateInvoiceAttachment([expenseId], file)
    setInvoiceReplaceFileByExpenseId((prev) => ({ ...prev, [expenseId]: null }))
    const replaceInput = invoiceReplaceInputRefs.current[expenseId]
    if (replaceInput) {
      replaceInput.value = ""
    }
    setExpenseIdsWithInvoice((prev) => new Set(prev).add(expenseId))
    await loadInvoiceDetails(expenseId)
    void refreshExpensesWithJoin()
  }

  const handleDeleteInvoice = async (expenseId: string) => {
    if (!projectId) return

    setInvoiceDeletingExpenseId(expenseId)
    const result = await deleteExpenseInvoiceAction({ projectId, expenseId })
    setInvoiceDeletingExpenseId(null)
    setInvoiceDeleteConfirmExpenseId(null)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Invoice removed.")
    clearImmediateInvoiceAttachment([expenseId])
    setExpenseIdsWithInvoice((prev) => {
      const next = new Set(prev)
      next.delete(expenseId)
      return next
    })
    setExpandedInvoiceExpenseIds((prev) => {
      const next = new Set(prev)
      next.delete(expenseId)
      return next
    })
    setInvoiceDetailsByExpenseId((prev) => {
      const next = { ...prev }
      delete next[expenseId]
      return next
    })
    setInvoiceReplaceFileByExpenseId((prev) => {
      const next = { ...prev }
      delete next[expenseId]
      return next
    })
    void refreshExpensesWithJoin()
  }

  const renderInvoiceFilePanel = (expenseId: string, invoice: ExpenseInvoiceWithItems) => {
    const details = invoiceDetailsByExpenseId[expenseId]
    const replaceFile = invoiceReplaceFileByExpenseId[expenseId]
    const isReplacing = invoiceReplacingExpenseId === expenseId
    const isDeleting = invoiceDeletingExpenseId === expenseId
    const viewUrl = details?.viewUrl ?? null
    const isImage = isInvoiceImageMimeType(invoice.file_mime_type)

    return (
      <div className="space-y-3 rounded-md border border-border bg-background/80 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{invoice.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {invoice.file_mime_type}
                {replaceFile ? ` · Replace with ${replaceFile.name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewUrl ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            ) : null}
            {canEnterData ? (
              <>
                <input
                  ref={(node) => {
                    invoiceReplaceInputRefs.current[expenseId] = node
                  }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(event) => handleInvoiceReplaceFileChange(expenseId, event)}
                  disabled={isReplacing || isDeleting}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isReplacing || isDeleting}
                  onClick={() => invoiceReplaceInputRefs.current[expenseId]?.click()}
                >
                  <Upload className="mr-1 h-3.5 w-3.5" />
                  {replaceFile ? "Change file" : "Re-upload"}
                </Button>
                {replaceFile ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isReplacing || isDeleting}
                    onClick={() => void handleReplaceInvoice(expenseId)}
                  >
                    {isReplacing ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1 h-3.5 w-3.5" />
                    )}
                    Replace invoice
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isReplacing || isDeleting}
                  onClick={() => setInvoiceDeleteConfirmExpenseId(expenseId)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isReplacing || isDeleting}
              onClick={() => collapseInvoiceDetails(expenseId)}
            >
              Continue
            </Button>
          </div>
        </div>
        {viewUrl ? (
          isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewUrl}
              alt={invoice.file_name}
              className="max-h-80 w-full rounded-md border border-border object-contain bg-muted/30"
            />
          ) : (
            <iframe
              src={viewUrl}
              title={invoice.file_name}
              className="h-80 w-full rounded-md border border-border bg-muted/30"
            />
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            Preview unavailable. Use Open to view the file in a new tab if you have access.
          </p>
        )}
      </div>
    )
  }

  const renderInvoiceLineItems = (expenseId: string) => {
    const invoiceDetails = invoiceDetailsByExpenseId[expenseId]

    if (invoiceDetails?.data?.items.length) {
      return (
        <div className="space-y-4 border-l-2 border-primary/30 pl-3">
          <div className="space-y-3">
            {invoiceDetails.data.items.map((item) => (
              <div key={item.id} className="text-sm">
                <p className="font-medium">{item.material_description_original}</p>
                <p className="text-muted-foreground">{formatInvoiceLineQuantity(item)}</p>
                <p>{formatINR(Number(item.total_amount))}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (
      invoiceDetails?.data?.processing_status === "processing" ||
      invoiceDetails?.data?.processing_status === "pending"
    ) {
      return (
        <p className="text-sm text-muted-foreground">
          Extracting line items… This usually takes 5–30 seconds. Expand again in a moment
          or click Continue and come back later.
        </p>
      )
    }

    if (invoiceDetails?.data?.processing_status === "failed") {
      return (
        <p className="text-sm text-destructive">
          Line item extraction failed. You can re-upload the invoice or continue with the
          expense as entered.
        </p>
      )
    }

    return (
      <p className="text-sm text-muted-foreground">No line items extracted yet.</p>
    )
  }

  const toggleInvoiceDetails = async (expenseId: string) => {
    if (expandedInvoiceExpenseIds.has(expenseId)) {
      setExpandedInvoiceExpenseIds((prev) => {
        const next = new Set(prev)
        next.delete(expenseId)
        return next
      })
      return
    }

    setExpandedInvoiceExpenseIds((prev) => new Set(prev).add(expenseId))

    const cached = invoiceDetailsByExpenseId[expenseId]
    if (!cached?.data || cached.error) {
      await loadInvoiceDetails(expenseId)
    }
  }

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
    
    if (!newExpense.category || !newExpense.description) {
      toast.error("Please fill in all required fields")
      return
    }

    if (!splitMode && !newExpense.amount) {
      toast.error("Please enter an amount")
      return
    }

    if (splitMode && !newExpense.amount) {
      toast.error("Enter the total amount to split")
      return
    }

    if (
      categoryUsesLabourTeams(newExpense.category, expenseCategories) &&
      !newExpense.labourTeamId
    ) {
      toast.error("Select which labour team received this payment")
      return
    }

    setIsSubmitting(true)

    const teamName = labourTeamNameById.get(newExpense.labourTeamId)
    const usesLabour = categoryUsesLabourTeams(newExpense.category, expenseCategories)
    const description = usesLabour
      ? newExpense.description
      : toExpenseDescription(newExpense.subcategory, newExpense.description)
    const fullDescription = teamName ? `${teamName} - ${description}` : description
    const totalAmount = parseFloat(newExpense.amount)

    if (splitMode) {
      if (!newExpense.vendor.trim()) {
        toast.error("Enter vendor name to track pending balance on the Payments tab")
        setIsSubmitting(false)
        return
      }

      if (!splitFirstAmount) {
        toast.error("Enter today's first payment amount")
        setIsSubmitting(false)
        return
      }

      const firstSplits = [
        { amount: splitFirstAmount, date: newExpense.date },
      ]
      const validation = validateInitialSplitCreate(totalAmount, firstSplits)
      if (!validation.ok) {
        toast.error(validation.error)
        setIsSubmitting(false)
        return
      }

      const result = await createExpenseSplitGroupAction({
        projectId,
        totalAmount,
        category: newExpense.category,
        description: fullDescription,
        vendorName: newExpense.vendor || null,
        billNumber: newExpense.billNumber || null,
        milestoneId: newExpense.milestoneId || null,
        labourTeamId: usesLabour ? newExpense.labourTeamId : null,
        subcategoryName: usesLabour ? null : newExpense.subcategory || null,
        splits: firstSplits,
      })

      if (!result.ok) {
        toast.error(result.error)
        setIsSubmitting(false)
        return
      }

      const pendingInvoiceFile = invoiceFile
      const firstExpenseId = result.data.expenseIds[0]

      toast.success(
        pendingInvoiceFile
          ? "Split expense saved. Uploading invoice in the background…"
          : "Split expense started — add more payments when they happen.",
      )
      setIsAddDialogOpen(false)
      resetNewExpenseForm()
      setIsSubmitting(false)
      void refreshExpenses()

      if (pendingInvoiceFile && firstExpenseId) {
        void uploadInvoiceInBackground(firstExpenseId, pendingInvoiceFile, result.data.expenseIds)
      }
      return
    }

    const result = await createExpenseAction({
      projectId,
      milestoneId: newExpense.milestoneId || null,
      category: newExpense.category,
      description: fullDescription,
      amount: parseFloat(newExpense.amount),
      vendorName: newExpense.vendor || null,
      billNumber: newExpense.billNumber || null,
      expenseDate: newExpense.date,
      labourTeamId: usesLabour ? newExpense.labourTeamId : null,
    })

    if (!result.ok) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    const row = result.data
    const names = project ? milestoneNameById(project) : new Map<string, string>()
    const milestoneId = (row.milestone_id as string | null) ?? null
    const expenseId = row.id as string
    const pendingInvoiceFile = invoiceFile ?? null

    setExpenses((prev) => [
      {
        id: expenseId,
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

    toast.success(
      pendingInvoiceFile
        ? "Expense saved. Uploading invoice in the background…"
        : "Expense added successfully!",
    )
    onProjectChange?.()
    resetNewExpenseForm()
    setIsAddDialogOpen(false)
    setIsSubmitting(false)

    if (pendingInvoiceFile) {
      void uploadInvoiceInBackground(expenseId, pendingInvoiceFile)
    }
  }

  const openEditExpense = (expense: Expense) => {
    if (expense.split_group_id) {
      setSplitGroupEditId(expense.split_group_id)
      return
    }
    const { subcategory, description } = splitExpenseDescription(expense.description)
    const labourTeamId = resolveLabourTeamId(expense.labour_team_id, expense.description)
    setEditingExpenseId(expense.id)
    setEditExpense({
      date: expense.expense_date,
      category: expense.category,
      subcategory: categoryUsesLabourTeams(expense.category, expenseCategories)
        ? ""
        : subcategory,
      labourTeamId,
      description: categoryUsesLabourTeams(expense.category, expenseCategories)
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

    if (
      categoryUsesLabourTeams(editExpense.category, expenseCategories) &&
      !editExpense.labourTeamId
    ) {
      toast.error("Select which labour team received this payment")
      return
    }

    setIsSubmitting(true)
    const teamName = labourTeamNameById.get(editExpense.labourTeamId)
    const usesLabour = categoryUsesLabourTeams(editExpense.category, expenseCategories)
    const description = usesLabour
      ? editExpense.description
      : toExpenseDescription(editExpense.subcategory, editExpense.description)
    const fullDescription = teamName ? `${teamName} - ${description}` : description
    const result = await updateExpenseAction({
      projectId,
      expenseId: editingExpenseId,
      milestoneId: editExpense.milestoneId || null,
      category: editExpense.category,
      description: fullDescription,
      amount: parseFloat(editExpense.amount),
      vendorName: editExpense.vendor || null,
      billNumber: editExpense.billNumber || null,
      expenseDate: editExpense.date,
      labourTeamId: usesLabour ? editExpense.labourTeamId : null,
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

  const categoryByLower = useMemo(
    () => new Map(categoryNames.map((cat) => [cat.toLowerCase(), cat])),
    [categoryNames],
  )

  const labourTeamByLower = useMemo(
    () => new Map(labourTeams.map((team) => [team.name.toLowerCase(), team])),
    [labourTeams],
  )

  const normalizeCategory = (value: string): string => {
    const cleaned = value.trim().toLowerCase()
    if (!cleaned) return ""
    return categoryByLower.get(cleaned) ?? value.trim()
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
    if (!projectId) {
      toast.error("Project ID is missing.")
      return
    }
    if (importDraftRows.length === 0) {
      toast.error("No rows to import.")
      return
    }

    setIsCommittingImport(true)
    setImportProgress({
      phase: "preparing",
      current: 0,
      total: importDraftRows.length,
      chunk: 0,
      chunkCount: 0,
      message: "Validating rows…",
    })

    try {
      const milestoneByName = new Map(
        milestones.map((m) => [m.name.trim().toLowerCase(), m.id]),
      )
      const failedReasons: string[] = []
      const rowsToCreate: Parameters<typeof bulkCreateExpensesAction>[0]["rows"] =
        []

      for (const row of importDraftRows) {
        const category = normalizeCategory(row.category)
        const description = row.description.trim()
        const amount = parseAmount(row.amount)
        const milestoneName = row.milestone.trim().toLowerCase()

        if (!category || !description || Number.isNaN(amount) || amount <= 0) {
          failedReasons.push(
            `Row ${row.rowNumber}: missing/invalid category, description, or amount`,
          )
          continue
        }

        const milestoneId = milestoneName ? (milestoneByName.get(milestoneName) ?? null) : null
        if (milestoneName && !milestoneId) {
          failedReasons.push(`Row ${row.rowNumber}: milestone "${row.milestone}" not found`)
          continue
        }

        const subcategory = row.subcategory.trim()
        const usesLabour = categoryUsesLabourTeams(category, expenseCategories)
        const labourTeam =
          usesLabour && subcategory
            ? labourTeamByLower.get(subcategory.toLowerCase())
            : undefined

        rowsToCreate.push({
          milestoneId,
          category,
          description: usesLabour
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
      }

      if (rowsToCreate.length === 0) {
        const preview = failedReasons.slice(0, 3).join(" | ")
        toast.error(
          preview
            ? `No rows imported. ${preview}`
            : "No valid rows to import. Check category, amount, and milestone names.",
        )
        return
      }

      const chunks: (typeof rowsToCreate)[] = []
      for (let i = 0; i < rowsToCreate.length; i += IMPORT_SERVER_CHUNK_SIZE) {
        chunks.push(rowsToCreate.slice(i, i + IMPORT_SERVER_CHUNK_SIZE))
      }

      let created = 0
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]
        const batchStart = chunkIndex * IMPORT_SERVER_CHUNK_SIZE

        setImportProgress({
          phase: "importing",
          current: batchStart,
          total: rowsToCreate.length,
          chunk: chunkIndex + 1,
          chunkCount: chunks.length,
          message: `Saving batch ${chunkIndex + 1} of ${chunks.length}…`,
        })

        const result = await bulkCreateExpensesAction({
          projectId,
          rows: chunk,
          deferMilestoneSync: true,
          deferRevalidate: true,
        })

        if (!result.ok) {
          toast.error(
            result.error +
              (created > 0 ? ` (${created} row(s) were saved before this error.)` : ""),
          )
          return
        }

        created += result.data.created

        setImportProgress({
          phase: "importing",
          current: Math.min(batchStart + chunk.length, rowsToCreate.length),
          total: rowsToCreate.length,
          chunk: chunkIndex + 1,
          chunkCount: chunks.length,
          message: `Saved batch ${chunkIndex + 1} of ${chunks.length}`,
        })
      }

      setImportProgress({
        phase: "syncing",
        current: rowsToCreate.length,
        total: rowsToCreate.length,
        chunk: chunks.length,
        chunkCount: chunks.length,
        message: "Updating milestone totals…",
      })

      const syncResult = await syncProjectMilestoneMetricsAction(projectId)
      if (!syncResult.ok) {
        toast.warning(
          `Imported ${created} expense(s), but milestone totals may be stale: ${syncResult.error}`,
        )
      }

      setImportProgress({
        phase: "refreshing",
        current: rowsToCreate.length,
        total: rowsToCreate.length,
        chunk: chunks.length,
        chunkCount: chunks.length,
        message: "Refreshing expense list…",
      })

      const skipped = failedReasons.length

      setIsImportDialogOpen(false)
      setImportDraftRows([])
      setLastSelectedIndex(null)

      if (skipped > 0) {
        const preview = failedReasons.slice(0, 3).join(" | ")
        toast.warning(
          `Imported ${created} expense(s). ${skipped} row(s) skipped. ${preview}`,
        )
      } else {
        toast.success(`Imported ${created} expense(s).`)
      }

      refreshExpensesAfterImport()
    } catch (error) {
      console.error("[expenses-tab] commit import:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Import failed. Please try again.",
      )
    } finally {
      setIsCommittingImport(false)
      setImportProgress(null)
    }
  }

  const handleImportFile = async (file: File | null) => {
    if (!file || !projectId) return

    setIsParsingImportFile(true)
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

      const parsedAt = Date.now()
      const draftRows: ImportDraftRow[] = rows.map((raw, index) => {
        const row = normalizeRow(raw)
        return {
          id: `${parsedAt}-${index}`,
          rowNumber: index + 2,
          date: parseExpenseDate(row.date),
          category: normalizeCategory(String(row.category ?? "")),
          subcategory: String(row.subcategory ?? "").trim(),
          description: String(row.description ?? "").trim(),
          vendor: String(row.vendor ?? "").trim(),
          amount: formatDraftAmount(row.amount),
          milestone: String(row.milestone ?? "").trim(),
          selected: false,
        }
      })

      startTransition(() => {
        setImportDraftRows(draftRows)
        setLastSelectedIndex(null)
        setIsImportDialogOpen(true)
      })
      toast.success(
        `Loaded ${draftRows.length} row(s). Review and click Import All Rows.`,
      )
    } catch (error) {
      console.error("[expenses-tab] import error:", error)
      toast.error("Failed to read file. Check format and try again.")
    } finally {
      setIsParsingImportFile(false)
      if (csvInputRef.current) csvInputRef.current.value = ""
      if (excelInputRef.current) excelInputRef.current.value = ""
    }
  }

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((expense) => {
        if (filterCategory !== "all" && expense.category !== filterCategory) return false
        if (filterStatus !== "all" && expense.status !== filterStatus) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime(),
      )
  }, [expenses, filterCategory, filterStatus])

  const visibleExpenses = useMemo(
    () =>
      showAllExpenses
        ? filteredExpenses
        : filteredExpenses.slice(0, EXPENSE_LIST_PREVIEW_LIMIT),
    [filteredExpenses, showAllExpenses],
  )
  const hiddenExpenseCount = Math.max(
    0,
    filteredExpenses.length - EXPENSE_LIST_PREVIEW_LIMIT,
  )

  useEffect(() => {
    setSelectedExpenseIds(new Set())
    setShowAllExpenses(false)
  }, [filterCategory, filterStatus])

  const allFilteredSelected =
    filteredExpenses.length > 0 &&
    filteredExpenses.every((e) => selectedExpenseIds.has(e.id))
  const someFilteredSelected =
    filteredExpenses.some((e) => selectedExpenseIds.has(e.id)) && !allFilteredSelected

  const toggleExpenseSelection = (expenseId: string, checked: boolean) => {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(expenseId)
      else next.delete(expenseId)
      return next
    })
  }

  const toggleAllFilteredExpenses = (checked: boolean) => {
    if (checked) {
      setSelectedExpenseIds(new Set(filteredExpenses.map((e) => e.id)))
    } else {
      setSelectedExpenseIds(new Set())
    }
  }

  const tableColSpan = canEnterData ? 9 : 7

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px]">Approved</Badge>
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-[10px]">Awaiting approval</Badge>
      case "rejected":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Rejected</Badge>
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>
    }
  }

  const getSplitPaymentBadge = (status: SplitPaymentDisplayStatus) => {
    switch (status) {
      case "Fully paid":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Fully paid</Badge>
      case "Partially paid":
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Partially paid</Badge>
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pending payment</Badge>
    }
  }

  const handleApproveSplit = async (expenseId: string) => {
    if (!projectId) return
    setIsSubmitting(true)
    const result = await updateExpenseStatusAction({
      projectId,
      expenseId,
      status: "approved",
    })
    setIsSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Split approved.")
    await refreshExpenses()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handleCategoryCardClick = (category: string) => {
    if (category === "all") {
      setFilterCategory("all")
      return
    }
    setFilterCategory((prev) => (prev === category ? "all" : category))
  }

  return (
    <div className="space-y-6">
      {project ? <ProjectFinancialSummary project={project} /> : null}

      <Card className="section-card border-border overflow-hidden">
        <CardContent className="pt-6">
          <ExpenseCategorySummary
            expenses={expenses}
            categoryNames={categoryNames}
            statusFilter={filterStatus}
            activeCategory={filterCategory}
            onCategoryClick={handleCategoryCardClick}
          />
        </CardContent>
      </Card>

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
                  <Button variant="outline" className="gap-2" disabled={isParsingImportFile || isCommittingImport}>
                    {isParsingImportFile ? (
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
              <Dialog
                open={isImportDialogOpen}
                onOpenChange={(open) => {
                  if (isCommittingImport) return
                  setIsImportDialogOpen(open)
                  if (!open) {
                    setImportDraftRows([])
                    setLastSelectedIndex(null)
                  }
                }}
              >
                <DialogContent className="w-[95vw] max-w-7xl bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Review Import Rows</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Tip: select multiple rows, then change milestone in any selected row to apply to all selected rows. Dates use dd/mm/yyyy from Excel/CSV.
                    {importDraftRows.length > IMPORT_PREVIEW_ROW_LIMIT && (
                      <span className="mt-1 block text-amber-600 dark:text-amber-500">
                        Large import ({importDraftRows.length} rows): showing first{" "}
                        {IMPORT_PREVIEW_ROW_LIMIT} for speed. All rows will be imported.
                      </span>
                    )}
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
                        {importDraftRows
                          .slice(0, IMPORT_PREVIEW_ROW_LIMIT)
                          .map((row, index) => (
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
                  {isCommittingImport && importProgress ? (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{importProgress.message}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {importProgress.phase === "importing"
                            ? `${Math.min(importProgress.current, importProgress.total)} / ${importProgress.total}`
                            : importProgress.phase === "preparing"
                              ? "…"
                              : "Done"}
                        </span>
                      </div>
                      <Progress
                        value={
                          importProgress.total > 0
                            ? Math.round(
                                (importProgress.current / importProgress.total) *
                                  100,
                              )
                            : 0
                        }
                        className="h-2"
                      />
                      {importProgress.chunkCount > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Batch {importProgress.chunk} of {importProgress.chunkCount}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={isCommittingImport}
                      onClick={() => {
                        setIsImportDialogOpen(false)
                        setImportDraftRows([])
                        setLastSelectedIndex(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void importDraftRowsToProject()}
                      disabled={isCommittingImport || importDraftRows.length === 0}
                    >
                      {isCommittingImport ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {importProgress?.message ?? "Importing…"}
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
                  {categoryNames.map((cat) => (
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
              <Button
                type="button"
                className="gap-2"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
              <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                  setIsAddDialogOpen(open)
                  if (!open) resetNewExpenseForm()
                }}
              >
                <DialogContent className={EXPENSE_DIALOG_CLASS}>
                  <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
                    <DialogTitle>Add New Expense</DialogTitle>
                  </DialogHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                  <div className="grid gap-4">
                    <div className={EXPENSE_FORM_ROW}>
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
                        <div className="flex items-center justify-between gap-2">
                          <Label>Category *</Label>
                          {canManageProjects && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => setCategoryManageOpen(true)}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                          )}
                        </div>
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
                            {categoryNames.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className={EXPENSE_FORM_ROW}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label>
                            {categoryUsesLabourTeams(newExpense.category, expenseCategories)
                              ? "Labour team *"
                              : "Subcategory"}
                          </Label>
                          {canManageProjects && newExpense.category && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={openSubcategoryManage}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                          )}
                        </div>
                        {categoryUsesLabourTeams(newExpense.category, expenseCategories) ? (
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
                                subcategoriesForCategory.get(newExpense.category)?.map((sub) => (
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
                    {suggestedSplitGroup && !splitMode && (
                      <PendingSplitSuggestion
                        label={suggestedSplitGroup.teamLabel}
                        category={suggestedSplitGroup.category}
                        recorded={suggestedSplitGroup.recorded}
                        total={suggestedSplitGroup.total}
                        remaining={suggestedSplitGroup.remaining}
                        splitCount={suggestedSplitGroup.splitCount}
                        vendor={suggestedSplitGroup.vendor}
                        onContinue={handleUseSuggestedSplit}
                      />
                    )}
                    {loadingOpenSplits &&
                      newExpense.category &&
                      (newExpense.labourTeamId || newExpense.subcategory) &&
                      !suggestedSplitGroup &&
                      !splitMode && (
                        <p className="text-xs text-muted-foreground">
                          Checking for pending split payments…
                        </p>
                      )}
                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea 
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                        placeholder="Enter expense description..."
                        className="bg-muted border-border"
                      />
                    </div>
                    <div className={EXPENSE_FORM_ROW}>
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
                        <div className="flex items-center justify-between gap-2">
                          <Label>{splitMode ? "Total amount *" : "Amount *"}</Label>
                          {!splitMode && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="text-xs text-primary underline-offset-2 hover:underline"
                                    onClick={() => {
                                      setSplitMode(true)
                                      setSplitFirstAmount("")
                                    }}
                                  >
                                    Want to split the payment?
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  This option allows you to split the amount, and
                                  part payment you can pay later.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <Input 
                          type="number"
                          value={newExpense.amount}
                          onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                          placeholder="0.00"
                          className="bg-muted border-border"
                        />
                        {splitMode && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline"
                            onClick={() => {
                              setSplitMode(false)
                              setSplitFirstAmount("")
                            }}
                          >
                            Cancel split (single payment)
                          </button>
                        )}
                      </div>
                    </div>
                    {splitMode && (
                      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                        <Label>First payment today *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={splitFirstAmount}
                          onChange={(e) => setSplitFirstAmount(e.target.value)}
                          placeholder="Amount paid today"
                          className="bg-muted border-border"
                          disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground">
                          Uses the expense date above. You can record split 2, 3, and
                          more on their actual dates later — no need to finish the full
                          total now. Each payment appears in the expenses table by date.
                        </p>
                      </div>
                    )}
                    <div className={EXPENSE_FORM_ROW}>
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
                        <Label>Upload Invoice</Label>
                        <input
                          ref={invoiceFileInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="hidden"
                          onChange={handleInvoiceFileChange}
                          disabled={isSubmitting}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full gap-2 bg-muted border-border"
                          onClick={() => invoiceFileInputRef.current?.click()}
                          disabled={isSubmitting}
                        >
                          <Upload className="h-4 w-4" />
                          {invoiceFile ? "Change Invoice" : "Upload Invoice"}
                        </Button>
                        {invoiceFile ? (
                          <p className="text-xs text-muted-foreground">
                            {invoiceFile.name} ({formatFileSize(invoiceFile.size)})
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            PDF, JPG, JPEG, or PNG up to 10MB. Optional — works with split
                            payments too (invoice links to the split group).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                  <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-6">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setIsAddDialogOpen(false)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="w-full sm:w-auto"
                        onClick={() => void handleAddExpense()}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {invoiceFile ? "Saving expense…" : "Adding..."}
                          </>
                        ) : (
                          "Add Expense"
                        )}
                      </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className={EXPENSE_DIALOG_CLASS}>
                  <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
                    <DialogTitle>Edit Expense</DialogTitle>
                  </DialogHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                  <div className="grid gap-4">
                    <div className={EXPENSE_FORM_ROW}>
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
                            {categoryNames.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className={EXPENSE_FORM_ROW}>
                      <div className="space-y-2">
                        <Label>
                          {categoryUsesLabourTeams(editExpense.category, expenseCategories)
                            ? "Labour team *"
                            : "Subcategory"}
                        </Label>
                        {categoryUsesLabourTeams(editExpense.category, expenseCategories) ? (
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
                                subcategoriesForCategory.get(editExpense.category)?.map((sub) => (
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
                    <div className={EXPENSE_FORM_ROW}>
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
                    <div className={EXPENSE_FORM_ROW}>
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
                  </div>
                  <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-6">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setIsEditDialogOpen(false)
                        setEditingExpenseId(null)
                      }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => void handleUpdateExpense()}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {canEnterData && projectId && (
            <ExpenseBulkToolbar
              projectId={projectId}
              rows={filteredExpenses}
              selectedIds={selectedExpenseIds}
              onSelectionChange={setSelectedExpenseIds}
              canEnterData={canEnterData}
              canManageProjects={Boolean(canManageProjects)}
              milestones={milestones}
              categoryNames={categoryNames}
              disabled={isSubmitting}
              onCompleted={refreshExpensesWithJoin}
            />
          )}
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  {canEnterData && (
                    <TableHead className="w-10 pr-0">
                      <ExpenseSelectAllCheckbox
                        allSelected={allFilteredSelected}
                        someSelected={someFilteredSelected}
                        onToggleAll={toggleAllFilteredExpenses}
                        disabled={isSubmitting || filteredExpenses.length === 0}
                      />
                    </TableHead>
                  )}
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
                    <TableCell colSpan={tableColSpan} className="text-center py-8 text-muted-foreground">
                      No expenses found. Click "Add Expense" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleExpenses.map((expense) => {
                    const isSplit = Boolean(expense.split_group_id && expense.split_number)
                    const groupPaymentStatus = expense.split_group_id
                      ? splitPaymentByGroupId.get(expense.split_group_id)
                      : null
                    const hasInvoice = expenseIdsWithInvoice.has(expense.id)
                    const invoiceAttachment = invoiceAttachmentByExpenseId[expense.id]
                    const isInvoiceExpanded = expandedInvoiceExpenseIds.has(expense.id)
                    const invoiceDetails = invoiceDetailsByExpenseId[expense.id]
                    const isSelected = selectedExpenseIds.has(expense.id)

                    return (
                    <Fragment key={expense.id}>
                    <TableRow
                      className={cn(
                        "border-border hover:bg-muted/50",
                        isSelected && "bg-primary/5",
                      )}
                    >
                      {canEnterData && (
                        <TableCell className="w-10 pr-0">
                          <ExpenseRowCheckbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              toggleExpenseSelection(expense.id, checked)
                            }
                            disabled={isSubmitting}
                            aria-label={`Select ${expense.description}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isSplit && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                    <Split className="h-3 w-3" />
                                    {expense.split_number}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Split {expense.split_number}
                                  {expense.split_total_amount != null &&
                                    ` of ${expense.split_total_amount.toLocaleString()} total`}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {format(new Date(expense.expense_date), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{expense.category}</p>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate">{expense.description}</p>
                        {uploadingInvoiceExpenseIds.has(expense.id) ? (
                          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Uploading invoice…
                          </span>
                        ) : null}
                        {invoiceAttachment ? (
                          <div className="mt-1 flex flex-col items-start gap-0.5">
                            <span className="max-w-full truncate text-xs text-muted-foreground">
                              📄 {invoiceAttachment.fileName}
                            </span>
                            <a
                              href={invoiceAttachment.viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                            >
                              View PDF
                            </a>
                          </div>
                        ) : null}
                        {hasInvoice ? (
                          <button
                            type="button"
                            className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
                            onClick={() => void toggleInvoiceDetails(expense.id)}
                          >
                            {isInvoiceExpanded
                              ? "Hide Invoice Details"
                              : "See Invoice Details"}
                          </button>
                        ) : null}
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
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          {isSplit && groupPaymentStatus
                            ? getSplitPaymentBadge(groupPaymentStatus)
                            : getApprovalBadge(expense.status)}
                          {isSplit && (
                            <span className="text-[10px] text-muted-foreground">
                              {getApprovalBadge(expense.status)}
                            </span>
                          )}
                          {canManageProjects && expense.status === "pending" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              disabled={isSubmitting}
                              onClick={() => void handleApproveSplit(expense.id)}
                            >
                              Approve
                            </Button>
                          )}
                        </div>
                      </TableCell>
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
                    {hasInvoice && isInvoiceExpanded ? (
                      <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={tableColSpan} className="py-3">
                          {invoiceDetails?.loading ? (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading invoice preview…
                              </p>
                            </div>
                          ) : invoiceDetails?.error ? (
                            <p className="text-sm text-destructive">{invoiceDetails.error}</p>
                          ) : invoiceDetails?.data ? (
                            <div className="space-y-4">
                              {renderInvoiceFilePanel(expense.id, invoiceDetails.data)}
                              {renderInvoiceLineItems(expense.id)}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Invoice not found.</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    </Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {hiddenExpenseCount > 0 && (
            <div className="pt-3 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => setShowAllExpenses((prev) => !prev)}
              >
                {showAllExpenses
                  ? "Show less"
                  : `Show more (${hiddenExpenseCount} more)`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {projectId && splitGroupEditId && (
        <ExpenseSplitGroupDialog
          open={Boolean(splitGroupEditId)}
          onOpenChange={(open) => {
            if (!open) setSplitGroupEditId(null)
          }}
          projectId={projectId}
          groupId={splitGroupEditId}
          canApprove={Boolean(canManageProjects)}
          onSaved={() => void refreshExpenses()}
        />
      )}

      {projectId && canManageProjects && (
        <>
          <ExpenseCategoryManageDialog
            open={categoryManageOpen}
            onOpenChange={setCategoryManageOpen}
            projectId={projectId}
            mode="categories"
            categories={expenseCategories}
            labourTeams={labourTeams}
            onSaved={() => void reloadExpenseOptions()}
          />
          <ExpenseCategoryManageDialog
            open={subcategoryManageOpen}
            onOpenChange={setSubcategoryManageOpen}
            projectId={projectId}
            mode={manageMode}
            categories={expenseCategories}
            selectedCategoryName={newExpense.category}
            labourTeams={labourTeams}
            onSaved={() => void reloadExpenseOptions()}
          />
        </>
      )}

      <AlertDialog
        open={invoiceDeleteConfirmExpenseId != null}
        onOpenChange={(open) => {
          if (!open) setInvoiceDeleteConfirmExpenseId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice file?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the uploaded invoice and any extracted line items for this expense.
              The expense entry itself will stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={invoiceDeletingExpenseId != null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={invoiceDeletingExpenseId != null || !invoiceDeleteConfirmExpenseId}
              onClick={(event) => {
                event.preventDefault()
                if (invoiceDeleteConfirmExpenseId) {
                  void handleDeleteInvoice(invoiceDeleteConfirmExpenseId)
                }
              }}
            >
              {invoiceDeletingExpenseId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete invoice"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
