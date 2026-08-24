"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Download, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  BulkEntryEditableGrid,
  bulkEntryRequiredNote,
  companyExpenseRowHasContent,
  companyIncomeRowHasContent,
  engineerRowHasContent,
  personalRowHasContent,
  projectRowHasContent,
} from "@/components/expense/bulk-entry-editable-grid"
import type { ExpenseCategoryView } from "@/lib/data/expense-categories"
import {
  exportEngineerBulkCsv,
  exportFinanceExpenseCsv,
  exportFinanceIncomeCsv,
  exportPersonalExpenseCsv,
  exportProjectBulkRowsCsv,
  parseEngineerBulkCsv,
  parseFinanceExpenseCsv,
  parseFinanceIncomeCsv,
  parsePersonalExpenseCsv,
  parseProjectBulkCsvWithSuggestions,
} from "@/lib/expense/bulk-entry-csv"
import {
  newRowId,
  type CompanyExpenseBulkRow,
  type CompanyIncomeBulkRow,
  type EngineerBulkRow,
  type PersonalExpenseBulkRow,
  type ProjectBulkRow,
} from "@/lib/expense/bulk-entry-types"
import {
  carryForwardCompanyExpenseRow,
  carryForwardCompanyIncomeRow,
  carryForwardPersonalExpenseRow,
  emptyCompanyExpenseRow,
  emptyCompanyIncomeRow,
  emptyPersonalExpenseRow,
  validateCompanyExpenseRow,
  validateCompanyIncomeRow,
  validatePersonalExpenseRow,
} from "@/lib/expense/bulk-entry-finance"
import {
  carryForwardProjectRow,
  emptyProjectBulkRow,
  mapProjectBulkRowToCreate,
  validateProjectBulkRow,
} from "@/lib/expense/bulk-entry-project"
import {
  bulkCreateCompanyExpensesAction,
  bulkCreateCompanyIncomeAction,
  bulkCreatePersonalExpensesAction,
} from "@/lib/finance/finance-actions"
import {
  bulkCreateExpensesAction,
  syncProjectMilestoneMetricsAction,
} from "@/lib/projects/tab-actions"
import {
  applySuggestionsToProjectRows,
  clearSuggestedFields,
  mergeSuggestedFieldMaps,
  type ExpenseHistoryItem,
  type SuggestedFieldKey,
  type SuggestedFieldMap,
} from "@/lib/expense/suggest-from-description"

const IMPORT_SERVER_CHUNK_SIZE = 50
const INITIAL_ROW_COUNT = 5
const BULK_DIALOG_CLASS =
  "flex max-h-[min(92dvh,100dvh)] flex-col gap-0 overflow-hidden border-border bg-card p-0 w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-[min(1400px,calc(100vw-2rem))] lg:max-w-[min(1600px,calc(100vw-3rem))] xl:max-w-[min(1800px,calc(100vw-4rem))]"

type Milestone = { id: string; name: string }
type LabourTeam = { id: string; name: string }

function emptyEngineerRow(): EngineerBulkRow {
  return {
    id: newRowId(),
    category: "",
    milestoneId: "",
    description: "",
    amount: "",
    vendor: "",
  }
}

function carryForwardEngineerRow(prev: EngineerBulkRow): EngineerBulkRow {
  return {
    ...emptyEngineerRow(),
    category: prev.category,
    milestoneId: prev.milestoneId,
  }
}

function validateEngineerRow(row: EngineerBulkRow, label: string) {
  if (!row.category) return `${label}: select category`
  if (!row.description.trim()) return `${label}: enter description`
  const amount = parseFloat(row.amount)
  if (!Number.isFinite(amount) || amount <= 0) return `${label}: enter valid amount`
  return null
}

function createInitialProjectRows(date: string, count: number): ProjectBulkRow[] {
  return Array.from({ length: count }, () => ({
    ...emptyProjectBulkRow(date),
    id: newRowId(),
  }))
}

function createInitialCompanyExpenseRows(
  date: string,
  category: string,
  count: number,
): CompanyExpenseBulkRow[] {
  return Array.from({ length: count }, () => ({
    ...emptyCompanyExpenseRow(date, category),
    id: newRowId(),
  }))
}

function createInitialCompanyIncomeRows(
  date: string,
  category: string,
  count: number,
): CompanyIncomeBulkRow[] {
  return Array.from({ length: count }, () => ({
    ...emptyCompanyIncomeRow(date, category),
    id: newRowId(),
  }))
}

function createInitialPersonalRows(
  date: string,
  category: string,
  count: number,
): PersonalExpenseBulkRow[] {
  return Array.from({ length: count }, () => ({
    ...emptyPersonalExpenseRow(date, category),
    id: newRowId(),
  }))
}

function createInitialEngineerRows(count: number): EngineerBulkRow[] {
  return Array.from({ length: count }, () => emptyEngineerRow())
}

type BaseProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

type ProjectBulkProps = BaseProps & {
  variant: "project"
  projectId: string
  categoryNames: string[]
  expenseCategories: ExpenseCategoryView[]
  labourTeams: LabourTeam[]
  milestones: Milestone[]
  subcategoriesForCategory: Map<string, string[]>
  canManageProjects: boolean
  history?: ExpenseHistoryItem[]
}

type EngineerBulkProps = BaseProps & {
  variant: "engineer"
  projectId: string
  milestones: Milestone[]
}

type FinanceBulkProps = BaseProps & {
  variant: "company_expense" | "company_income" | "personal_expense"
  categories: string[]
  defaultCategory?: string
}

export type ExpenseBulkEntryDialogProps =
  | ProjectBulkProps
  | EngineerBulkProps
  | FinanceBulkProps

export function ExpenseBulkEntryDialog(props: ExpenseBulkEntryDialogProps) {
  const today = format(new Date(), "yyyy-MM-dd")
  const variant = props.variant
  const financeDefaultCategory =
    variant === "company_expense" ||
    variant === "company_income" ||
    variant === "personal_expense"
      ? props.defaultCategory ?? ""
      : ""

  const [saving, setSaving] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [projectRows, setProjectRows] = useState<ProjectBulkRow[]>(() =>
    createInitialProjectRows(today, INITIAL_ROW_COUNT),
  )
  const [engineerRows, setEngineerRows] = useState<EngineerBulkRow[]>(() =>
    createInitialEngineerRows(INITIAL_ROW_COUNT),
  )
  const [companyExpenseRows, setCompanyExpenseRows] = useState<CompanyExpenseBulkRow[]>(
    () => createInitialCompanyExpenseRows(today, financeDefaultCategory, INITIAL_ROW_COUNT),
  )
  const [companyIncomeRows, setCompanyIncomeRows] = useState<CompanyIncomeBulkRow[]>(() =>
    createInitialCompanyIncomeRows(today, financeDefaultCategory, INITIAL_ROW_COUNT),
  )
  const [personalRows, setPersonalRows] = useState<PersonalExpenseBulkRow[]>(() =>
    createInitialPersonalRows(today, financeDefaultCategory, INITIAL_ROW_COUNT),
  )
  const [suggestedFields, setSuggestedFields] = useState<SuggestedFieldMap>({})

  const resetAll = useCallback(() => {
    setSelectedRowId(null)
    setProjectRows(createInitialProjectRows(today, INITIAL_ROW_COUNT))
    setEngineerRows(createInitialEngineerRows(INITIAL_ROW_COUNT))
    setCompanyExpenseRows(
      createInitialCompanyExpenseRows(today, financeDefaultCategory, INITIAL_ROW_COUNT),
    )
    setCompanyIncomeRows(
      createInitialCompanyIncomeRows(today, financeDefaultCategory, INITIAL_ROW_COUNT),
    )
    setPersonalRows(
      createInitialPersonalRows(today, financeDefaultCategory, INITIAL_ROW_COUNT),
    )
    setSuggestedFields({})
  }, [financeDefaultCategory, today])

  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (props.open && !wasOpenRef.current) {
      resetAll()
    }
    wasOpenRef.current = props.open
  }, [props.open, resetAll])

  const addRow = () => {
    if (variant === "project") {
      setProjectRows((prev) => {
        const source = prev.find((r) => r.id === selectedRowId) ?? prev[prev.length - 1]
        const next = { ...carryForwardProjectRow(source), id: newRowId() }
        setSelectedRowId(next.id)
        return [...prev, next]
      })
      return
    }
    if (variant === "engineer") {
      setEngineerRows((prev) => {
        const source = prev.find((r) => r.id === selectedRowId) ?? prev[prev.length - 1]
        const next = carryForwardEngineerRow(source)
        setSelectedRowId(next.id)
        return [...prev, next]
      })
      return
    }
    if (variant === "company_expense") {
      setCompanyExpenseRows((prev) => {
        const source = prev.find((r) => r.id === selectedRowId) ?? prev[prev.length - 1]
        const next = { ...carryForwardCompanyExpenseRow(source), id: newRowId() }
        setSelectedRowId(next.id)
        return [...prev, next]
      })
      return
    }
    if (variant === "company_income") {
      setCompanyIncomeRows((prev) => {
        const source = prev.find((r) => r.id === selectedRowId) ?? prev[prev.length - 1]
        const next = { ...carryForwardCompanyIncomeRow(source), id: newRowId() }
        setSelectedRowId(next.id)
        return [...prev, next]
      })
      return
    }
    setPersonalRows((prev) => {
      const source = prev.find((r) => r.id === selectedRowId) ?? prev[prev.length - 1]
      const next = { ...carryForwardPersonalExpenseRow(source), id: newRowId() }
      setSelectedRowId(next.id)
      return [...prev, next]
    })
  }

  const deleteRow = () => {
    const removeFrom = <T extends { id: string }>(
      rows: T[],
      createEmpty: () => T,
      setRows: (rows: T[]) => void,
    ) => {
      if (rows.length <= 1) {
        toast.error("At least one row is required.")
        return
      }
      const targetId = selectedRowId ?? rows[rows.length - 1]?.id
      if (!targetId) return
      const next = rows.filter((r) => r.id !== targetId)
      setRows(next.length ? next : [createEmpty()])
      setSelectedRowId(next[0]?.id ?? null)
      setSuggestedFields((prev) => {
        const copy = { ...prev }
        delete copy[targetId]
        return copy
      })
    }

    if (variant === "project") {
      removeFrom(projectRows, () => ({ ...emptyProjectBulkRow(today), id: newRowId() }), setProjectRows)
    } else if (variant === "engineer") {
      removeFrom(engineerRows, emptyEngineerRow, setEngineerRows)
    } else if (variant === "company_expense") {
      removeFrom(
        companyExpenseRows,
        () => ({ ...emptyCompanyExpenseRow(today, financeDefaultCategory), id: newRowId() }),
        setCompanyExpenseRows,
      )
    } else if (variant === "company_income") {
      removeFrom(
        companyIncomeRows,
        () => ({ ...emptyCompanyIncomeRow(today, financeDefaultCategory), id: newRowId() }),
        setCompanyIncomeRows,
      )
    } else {
      removeFrom(
        personalRows,
        () => ({ ...emptyPersonalExpenseRow(today, financeDefaultCategory), id: newRowId() }),
        setPersonalRows,
      )
    }
  }

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    try {
      if (variant === "project") {
        const { rows: imported, suggested } = parseProjectBulkCsvWithSuggestions(
          text,
          today,
          props.milestones,
          {
            categories: props.expenseCategories,
            milestones: props.milestones,
            labourTeams: props.labourTeams,
            history: props.history ?? [],
          },
        )
        if (!imported.length) {
          toast.error("No rows found in CSV.")
          return
        }
        setProjectRows(imported)
        setSuggestedFields(suggested)
        setSelectedRowId(imported[0]?.id ?? null)
        const suggestedCount = Object.values(suggested).reduce(
          (count, fields) => count + Object.keys(fields).length,
          0,
        )
        toast.success(
          suggestedCount > 0
            ? `Imported ${imported.length} row(s). Suggested ${suggestedCount} empty field(s) from descriptions.`
            : `Imported ${imported.length} row(s) from CSV.`,
        )
      } else if (variant === "engineer") {
        const imported = parseEngineerBulkCsv(text, props.milestones)
        if (!imported.length) {
          toast.error("No rows found in CSV.")
          return
        }
        setEngineerRows(imported)
        setSelectedRowId(imported[0]?.id ?? null)
        toast.success(`Imported ${imported.length} row(s) from CSV.`)
      } else if (variant === "company_expense") {
        const imported = parseFinanceExpenseCsv(text, today)
        if (!imported.length) {
          toast.error("No rows found in CSV.")
          return
        }
        setCompanyExpenseRows(imported)
        setSelectedRowId(imported[0]?.id ?? null)
        toast.success(`Imported ${imported.length} row(s) from CSV.`)
      } else if (variant === "company_income") {
        const imported = parseFinanceIncomeCsv(text, today)
        if (!imported.length) {
          toast.error("No rows found in CSV.")
          return
        }
        setCompanyIncomeRows(imported)
        setSelectedRowId(imported[0]?.id ?? null)
        toast.success(`Imported ${imported.length} row(s) from CSV.`)
      } else {
        const imported = parsePersonalExpenseCsv(text, today)
        if (!imported.length) {
          toast.error("No rows found in CSV.")
          return
        }
        setPersonalRows(imported)
        setSelectedRowId(imported[0]?.id ?? null)
        toast.success(`Imported ${imported.length} row(s) from CSV.`)
      }
    } catch {
      toast.error("Could not parse CSV file.")
    }
  }

  const handleSuggestFromDescriptions = () => {
    if (variant !== "project") return
    if (!projectRows.some((row) => row.description.trim())) {
      toast.error("Add descriptions first.")
      return
    }
    const { rows, suggested } = applySuggestionsToProjectRows(projectRows, {
      categories: props.expenseCategories,
      milestones: props.milestones,
      labourTeams: props.labourTeams,
      history: props.history ?? [],
    })
    const filledCount = Object.values(suggested).reduce(
      (count, fields) => count + Object.keys(fields).length,
      0,
    )
    setProjectRows(rows)
    setSuggestedFields((prev) => mergeSuggestedFieldMaps(prev, suggested))
    if (filledCount === 0) {
      toast.message("No empty category, subcategory, or milestone fields to fill.")
      return
    }
    toast.success(
      `Suggested ${filledCount} field(s) from descriptions. Review highlighted cells before saving.`,
    )
  }

  const handleExport = () => {
    if (variant === "project") {
      exportProjectBulkRowsCsv(projectRows.filter(projectRowHasContent), props.milestones)
    } else if (variant === "engineer") {
      exportEngineerBulkCsv(engineerRows.filter(engineerRowHasContent), props.milestones)
    } else if (variant === "company_expense") {
      exportFinanceExpenseCsv(companyExpenseRows.filter(companyExpenseRowHasContent))
    } else if (variant === "company_income") {
      exportFinanceIncomeCsv(companyIncomeRows.filter(companyIncomeRowHasContent))
    } else {
      exportPersonalExpenseCsv(personalRows.filter(personalRowHasContent))
    }
  }

  const handleUpdateExpense = async () => {
    setSaving(true)
    try {
      if (variant === "project") {
        const rows = projectRows.filter(projectRowHasContent)
        if (rows.length === 0) {
          toast.error("Enter at least one expense line in the table.")
          return
        }
        for (let i = 0; i < rows.length; i++) {
          const err = validateProjectBulkRow(
            rows[i],
            props.expenseCategories,
            props.milestones.length,
            `Row ${i + 1}`,
          )
          if (err) {
            toast.error(err)
            return
          }
        }
        const labourTeamNameById = new Map(
          props.labourTeams.map((t) => [t.id, t.name]),
        )
        const rowsToCreate = rows.map((row) =>
          mapProjectBulkRowToCreate(
            row,
            props.expenseCategories,
            labourTeamNameById,
            "approved",
          ),
        )
        const chunks: (typeof rowsToCreate)[] = []
        for (let i = 0; i < rowsToCreate.length; i += IMPORT_SERVER_CHUNK_SIZE) {
          chunks.push(rowsToCreate.slice(i, i + IMPORT_SERVER_CHUNK_SIZE))
        }
        let created = 0
        for (const chunk of chunks) {
          const result = await bulkCreateExpensesAction({
            projectId: props.projectId,
            rows: chunk,
            deferMilestoneSync: true,
            deferRevalidate: true,
          })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          created += result.data.created
        }
        await syncProjectMilestoneMetricsAction(props.projectId)
        toast.success(`Updated ${created} expense(s).`)
      } else if (variant === "engineer") {
        const rows = engineerRows.filter(engineerRowHasContent)
        if (rows.length === 0) {
          toast.error("Enter at least one expense line in the table.")
          return
        }
        for (let i = 0; i < rows.length; i++) {
          const err = validateEngineerRow(rows[i], `Row ${i + 1}`)
          if (err) {
            toast.error(err)
            return
          }
        }
        const rowsToCreate = rows.map((row) => ({
          milestoneId: row.milestoneId || null,
          category: row.category,
          description: row.description.trim(),
          amount: parseFloat(row.amount),
          vendorName: row.vendor.trim() || null,
          billNumber: null,
          expenseDate: today,
          status: "pending" as const,
        }))
        const result = await bulkCreateExpensesAction({
          projectId: props.projectId,
          rows: rowsToCreate,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`Submitted ${result.data.created} expense(s) for approval.`)
      } else if (variant === "company_expense") {
        const rows = companyExpenseRows.filter(companyExpenseRowHasContent)
        if (rows.length === 0) {
          toast.error("Enter at least one expense line in the table.")
          return
        }
        for (let i = 0; i < rows.length; i++) {
          const err = validateCompanyExpenseRow(rows[i], `Row ${i + 1}`)
          if (err) {
            toast.error(err)
            return
          }
        }
        const result = await bulkCreateCompanyExpensesAction({
          rows: rows.map((row) => ({
            category: row.category,
            description: row.description.trim(),
            amount: Number(row.amount),
            vendorName: row.vendor.trim() || null,
            expenseDate: row.date,
          })),
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`Updated ${result.data.created} company expense(s).`)
      } else if (variant === "company_income") {
        const rows = companyIncomeRows.filter(companyIncomeRowHasContent)
        if (rows.length === 0) {
          toast.error("Enter at least one expense line in the table.")
          return
        }
        for (let i = 0; i < rows.length; i++) {
          const err = validateCompanyIncomeRow(rows[i], `Row ${i + 1}`)
          if (err) {
            toast.error(err)
            return
          }
        }
        const result = await bulkCreateCompanyIncomeAction({
          rows: rows.map((row) => ({
            category: row.category,
            description: row.description.trim(),
            amount: Number(row.amount),
            sourceName: row.source.trim() || null,
            receivedDate: row.date,
          })),
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`Updated ${result.data.created} income entry(ies).`)
      } else {
        const rows = personalRows.filter(personalRowHasContent)
        if (rows.length === 0) {
          toast.error("Enter at least one expense line in the table.")
          return
        }
        for (let i = 0; i < rows.length; i++) {
          const err = validatePersonalExpenseRow(rows[i], `Row ${i + 1}`)
          if (err) {
            toast.error(err)
            return
          }
        }
        const result = await bulkCreatePersonalExpensesAction({
          rows: rows.map((row) => ({
            category: row.category,
            description: row.description.trim(),
            amount: Number(row.amount),
            expenseDate: row.date,
          })),
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`Updated ${result.data.created} personal expense(s).`)
      }

      props.onOpenChange(false)
      props.onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const title =
    variant === "project"
      ? "Bulk expense entry"
      : variant === "engineer"
        ? "Bulk site expenses"
        : variant === "company_expense"
          ? "Bulk company expenses"
          : variant === "company_income"
            ? "Bulk company income"
            : "Bulk personal expenses"

  const filledCount =
    variant === "project"
      ? projectRows.filter(projectRowHasContent).length
      : variant === "engineer"
        ? engineerRows.filter(engineerRowHasContent).length
        : variant === "company_expense"
          ? companyExpenseRows.filter(companyExpenseRowHasContent).length
          : variant === "company_income"
            ? companyIncomeRows.filter(companyIncomeRowHasContent).length
            : personalRows.filter(personalRowHasContent).length

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (saving) return
        props.onOpenChange(open)
      }}
    >
      <DialogContent className={BULK_DIALOG_CLASS}>
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter multiple expense lines in the table below. You can add, edit, or
            delete rows as needed. Click Update expense when all lines are completed.
          </p>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2 sm:px-6">
          <Button type="button" size="sm" className="gap-1.5" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Add row
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={deleteRow}
          >
            <Trash2 className="h-4 w-4" />
            Delete row
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          {variant === "project" && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={handleSuggestFromDescriptions}
            >
              <Sparkles className="h-4 w-4" />
              Suggest from descriptions
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={handleExport}
            disabled={filledCount === 0}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImportFile(file)
              e.target.value = ""
            }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          {variant === "project" && (
            <BulkEntryEditableGrid
              variant="project"
              rows={projectRows}
              selectedRowId={selectedRowId}
              onSelectRow={setSelectedRowId}
              onUpdateRow={(id, patch) => {
                setProjectRows((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
                )
                const keys: SuggestedFieldKey[] = []
                if ("category" in patch) keys.push("category", "subcategory", "labourTeamId")
                if ("subcategory" in patch) keys.push("subcategory")
                if ("labourTeamId" in patch) keys.push("labourTeamId")
                if ("milestoneId" in patch) keys.push("milestoneId")
                if (keys.length > 0) {
                  setSuggestedFields((prev) => clearSuggestedFields(prev, id, keys))
                }
              }}
              categoryNames={props.categoryNames}
              expenseCategories={props.expenseCategories}
              labourTeams={props.labourTeams}
              milestones={props.milestones}
              subcategoriesForCategory={props.subcategoriesForCategory}
              suggestedFields={suggestedFields}
            />
          )}
          {variant === "engineer" && (
            <BulkEntryEditableGrid
              variant="engineer"
              rows={engineerRows}
              selectedRowId={selectedRowId}
              onSelectRow={setSelectedRowId}
              onUpdateRow={(id, patch) =>
                setEngineerRows((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
                )
              }
              milestones={props.milestones}
            />
          )}
          {variant === "company_expense" && (
            <BulkEntryEditableGrid
              variant="company_expense"
              rows={companyExpenseRows}
              selectedRowId={selectedRowId}
              onSelectRow={setSelectedRowId}
              onUpdateRow={(id, patch) =>
                setCompanyExpenseRows((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
                )
              }
              categories={props.categories}
            />
          )}
          {variant === "company_income" && (
            <BulkEntryEditableGrid
              variant="company_income"
              rows={companyIncomeRows}
              selectedRowId={selectedRowId}
              onSelectRow={setSelectedRowId}
              onUpdateRow={(id, patch) =>
                setCompanyIncomeRows((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
                )
              }
              categories={props.categories}
            />
          )}
          {variant === "personal_expense" && (
            <BulkEntryEditableGrid
              variant="personal_expense"
              rows={personalRows}
              selectedRowId={selectedRowId}
              onSelectRow={setSelectedRowId}
              onUpdateRow={(id, patch) =>
                setPersonalRows((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
                )
              }
              categories={props.categories}
            />
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col items-stretch gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground sm:max-w-md">
            Note: {bulkEntryRequiredNote(variant)}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleUpdateExpense()}
              disabled={saving || filledCount === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Update expense"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
