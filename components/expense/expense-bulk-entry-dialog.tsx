"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BulkEntryCompletedTable } from "@/components/expense/bulk-entry-completed-table"
import { ProjectAddExpenseDialogForm } from "@/components/projects/project-detail/project-add-expense-dialog-form"
import type { ExpenseCategoryView } from "@/lib/data/expense-categories"
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
  categoryUsesLabourTeams,
  emptyProjectBulkRow,
  mapProjectBulkRowToCreate,
  validateProjectBulkRow,
} from "@/lib/expense/bulk-entry-project"
import type { MandatoryFieldDef } from "@/lib/keyboard/mandatory-expense-fields"
import {
  MandatoryExpenseKeyboardProvider,
  MandatoryExpenseSubmitButton,
} from "@/lib/keyboard/mandatory-expense-keyboard"
import {
  bulkCreateCompanyExpensesAction,
  bulkCreateCompanyIncomeAction,
  bulkCreatePersonalExpensesAction,
} from "@/lib/finance/finance-actions"
import {
  bulkCreateExpensesAction,
  syncProjectMilestoneMetricsAction,
} from "@/lib/projects/tab-actions"

const IMPORT_SERVER_CHUNK_SIZE = 50
const BULK_DIALOG_CLASS =
  "flex max-h-[min(92dvh,100dvh)] flex-col gap-0 overflow-hidden border-border bg-card p-0 w-[95vw] max-w-5xl"

type Milestone = { id: string; name: string }
type LabourTeam = { id: string; name: string }

const ENGINEER_CATEGORIES = ["Materials", "Labour", "Equipment", "Miscellaneous"]

function emptyEngineerRow(): EngineerBulkRow {
  return {
    id: "",
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

  const [saving, setSaving] = useState(false)
  const [projectCompleted, setProjectCompleted] = useState<ProjectBulkRow[]>([])
  const [engineerCompleted, setEngineerCompleted] = useState<EngineerBulkRow[]>([])
  const [companyExpenseCompleted, setCompanyExpenseCompleted] = useState<
    CompanyExpenseBulkRow[]
  >([])
  const [companyIncomeCompleted, setCompanyIncomeCompleted] = useState<
    CompanyIncomeBulkRow[]
  >([])
  const [personalCompleted, setPersonalCompleted] = useState<PersonalExpenseBulkRow[]>(
    [],
  )

  const [projectActive, setProjectActive] = useState(() => emptyProjectBulkRow(today))
  const [engineerActive, setEngineerActive] = useState(emptyEngineerRow)
  const [companyExpenseActive, setCompanyExpenseActive] = useState(() =>
    emptyCompanyExpenseRow(today, props.variant === "company_expense" ? props.defaultCategory ?? "" : ""),
  )
  const [companyIncomeActive, setCompanyIncomeActive] = useState(() =>
    emptyCompanyIncomeRow(today, props.variant === "company_income" ? props.defaultCategory ?? "" : ""),
  )
  const [personalActive, setPersonalActive] = useState(() =>
    emptyPersonalExpenseRow(today, props.variant === "personal_expense" ? props.defaultCategory ?? "" : ""),
  )

  const resetAll = useCallback(() => {
    setProjectCompleted([])
    setEngineerCompleted([])
    setCompanyExpenseCompleted([])
    setCompanyIncomeCompleted([])
    setPersonalCompleted([])
    setProjectActive(emptyProjectBulkRow(today))
    setEngineerActive(emptyEngineerRow())
    if (props.variant === "company_expense") {
      setCompanyExpenseActive(emptyCompanyExpenseRow(today, props.defaultCategory ?? ""))
    } else {
      setCompanyExpenseActive(emptyCompanyExpenseRow(today))
    }
    if (props.variant === "company_income") {
      setCompanyIncomeActive(emptyCompanyIncomeRow(today, props.defaultCategory ?? ""))
    } else {
      setCompanyIncomeActive(emptyCompanyIncomeRow(today))
    }
    if (props.variant === "personal_expense") {
      setPersonalActive(emptyPersonalExpenseRow(today, props.defaultCategory ?? ""))
    } else {
      setPersonalActive(emptyPersonalExpenseRow(today))
    }
  }, [props, today])

  useEffect(() => {
    if (!props.open) return
    resetAll()
  }, [props.open, resetAll])

  const projectNewExpense = useMemo(
    () => ({
      date: projectActive.date,
      category: projectActive.category,
      subcategory: projectActive.subcategory,
      labourTeamId: projectActive.labourTeamId,
      description: projectActive.description,
      vendor: projectActive.vendor,
      amount: projectActive.amount,
      billNumber: "",
      milestoneId: projectActive.milestoneId,
    }),
    [projectActive],
  )

  const usesLabourCategory =
    props.variant === "project"
      ? categoryUsesLabourTeams(projectActive.category, props.expenseCategories)
      : false

  const projectMandatoryFields = useMemo((): MandatoryFieldDef[] => {
    if (props.variant !== "project") return []
    const categoryOptions = props.categoryNames.map((cat) => ({
      value: cat,
      label: cat,
    }))
    const labourOptions = props.labourTeams.map((team) => ({
      value: team.id,
      label: team.name,
    }))
    const subcategoryOptions = (
      props.subcategoriesForCategory.get(projectActive.category) ?? []
    ).map((sub) => ({ value: sub, label: sub }))
    const milestoneOptions = props.milestones.map((m) => ({
      value: m.id,
      label: m.name,
    }))

    const fields: MandatoryFieldDef[] = [
      { id: "date", kind: "date" },
      {
        id: "category",
        kind: "select",
        options: categoryOptions,
        getValue: () => projectActive.category,
        setValue: (value) =>
          setProjectActive((prev) => ({
            ...prev,
            category: value,
            subcategory: "",
            labourTeamId: "",
          })),
        validate: () => (projectActive.category ? null : "Select category"),
      },
      {
        id: "subcategoryOrTeam",
        kind: "select",
        skip: !usesLabourCategory || !projectActive.category,
        options: labourOptions,
        getValue: () => projectActive.labourTeamId,
        setValue: (value) =>
          setProjectActive((prev) => ({ ...prev, labourTeamId: value })),
        validate: () =>
          projectActive.labourTeamId ? null : "Select labour team",
      },
      {
        id: "subcategory",
        kind: "select",
        skip: usesLabourCategory || !projectActive.category,
        options: subcategoryOptions,
        getValue: () => projectActive.subcategory,
        setValue: (value) =>
          setProjectActive((prev) => ({ ...prev, subcategory: value })),
        validate: () =>
          projectActive.subcategory ? null : "Select subcategory",
      },
      {
        id: "milestone",
        kind: "select",
        skip: props.milestones.length === 0,
        options: milestoneOptions,
        getValue: () => projectActive.milestoneId,
        setValue: (value) =>
          setProjectActive((prev) => ({ ...prev, milestoneId: value })),
        validate: () =>
          projectActive.milestoneId ? null : "Select stage/milestone",
      },
      {
        id: "description",
        kind: "text",
        validate: () =>
          projectActive.description.trim() ? null : "Enter description",
      },
      {
        id: "amount",
        kind: "number",
        validate: () => {
          const amount = parseFloat(projectActive.amount)
          return Number.isFinite(amount) && amount > 0 ? null : "Enter amount"
        },
      },
    ]
    return fields
  }, [projectActive, props, usesLabourCategory])

  const addProjectLine = useCallback(() => {
    if (props.variant !== "project") return
    const err = validateProjectBulkRow(
      projectActive,
      props.expenseCategories,
      props.milestones.length,
      "Current line",
    )
    if (err) {
      toast.error(err)
      return
    }
    const saved = { ...projectActive, id: newRowId() }
    setProjectCompleted((prev) => [...prev, saved])
    setProjectActive(carryForwardProjectRow(saved))
    toast.success(`Line ${projectCompleted.length + 1} added`)
  }, [projectActive, projectCompleted.length, props])

  const addEngineerLine = useCallback(() => {
    const err = validateEngineerRow(engineerActive, "Current line")
    if (err) {
      toast.error(err)
      return
    }
    const saved = { ...engineerActive, id: newRowId() }
    setEngineerCompleted((prev) => [...prev, saved])
    setEngineerActive(carryForwardEngineerRow(saved))
  }, [engineerActive])

  const addCompanyExpenseLine = useCallback(() => {
    const err = validateCompanyExpenseRow(companyExpenseActive, "Current line")
    if (err) {
      toast.error(err)
      return
    }
    const saved = { ...companyExpenseActive, id: newRowId() }
    setCompanyExpenseCompleted((prev) => [...prev, saved])
    setCompanyExpenseActive(carryForwardCompanyExpenseRow(saved))
  }, [companyExpenseActive])

  const addCompanyIncomeLine = useCallback(() => {
    const err = validateCompanyIncomeRow(companyIncomeActive, "Current line")
    if (err) {
      toast.error(err)
      return
    }
    const saved = { ...companyIncomeActive, id: newRowId() }
    setCompanyIncomeCompleted((prev) => [...prev, saved])
    setCompanyIncomeActive(carryForwardCompanyIncomeRow(saved))
  }, [companyIncomeActive])

  const addPersonalLine = useCallback(() => {
    const err = validatePersonalExpenseRow(personalActive, "Current line")
    if (err) {
      toast.error(err)
      return
    }
    const saved = { ...personalActive, id: newRowId() }
    setPersonalCompleted((prev) => [...prev, saved])
    setPersonalActive(carryForwardPersonalExpenseRow(saved))
  }, [personalActive])

  const completedCount =
    props.variant === "project"
      ? projectCompleted.length
      : props.variant === "engineer"
        ? engineerCompleted.length
        : props.variant === "company_expense"
          ? companyExpenseCompleted.length
          : props.variant === "company_income"
            ? companyIncomeCompleted.length
            : personalCompleted.length

  const handleUpdateExpense = async () => {
    if (completedCount === 0) {
      toast.error("Add at least one completed line first.")
      return
    }

    setSaving(true)
    try {
      if (props.variant === "project") {
        const labourTeamNameById = new Map(
          props.labourTeams.map((t) => [t.id, t.name]),
        )
        const rowsToCreate = projectCompleted.map((row) =>
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
      } else if (props.variant === "engineer") {
        const rowsToCreate = engineerCompleted.map((row) => ({
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
      } else if (props.variant === "company_expense") {
        const result = await bulkCreateCompanyExpensesAction({
          rows: companyExpenseCompleted.map((row) => ({
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
      } else if (props.variant === "company_income") {
        const result = await bulkCreateCompanyIncomeAction({
          rows: companyIncomeCompleted.map((row) => ({
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
        const result = await bulkCreatePersonalExpensesAction({
          rows: personalCompleted.map((row) => ({
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
    props.variant === "project"
      ? "Bulk expense entry"
      : props.variant === "engineer"
        ? "Bulk site expenses"
        : props.variant === "company_expense"
          ? "Bulk company expenses"
          : props.variant === "company_income"
            ? "Bulk company income"
            : "Bulk personal expenses"

  const removeRow = (id: string) => {
    if (props.variant === "project") {
      setProjectCompleted((prev) => prev.filter((r) => r.id !== id))
    } else if (props.variant === "engineer") {
      setEngineerCompleted((prev) => prev.filter((r) => r.id !== id))
    } else if (props.variant === "company_expense") {
      setCompanyExpenseCompleted((prev) => prev.filter((r) => r.id !== id))
    } else if (props.variant === "company_income") {
      setCompanyIncomeCompleted((prev) => prev.filter((r) => r.id !== id))
    } else {
      setPersonalCompleted((prev) => prev.filter((r) => r.id !== id))
    }
  }

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
            Complete one line at a time. The next line copies Date, Category,
            Subcategory/Team, and Milestone from the previous line.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="mb-3 text-sm font-medium">Current line</p>

            {props.variant === "project" && (
              <MandatoryExpenseKeyboardProvider
                enabled={props.open}
                fields={projectMandatoryFields}
                onSubmit={addProjectLine}
                autoAdvanceSelectOnLetter
              >
                <ProjectAddExpenseDialogForm
                  newExpense={projectNewExpense}
                  setNewExpense={(updater) => {
                    setProjectActive((prev) => {
                      const current = {
                        date: prev.date,
                        category: prev.category,
                        subcategory: prev.subcategory,
                        labourTeamId: prev.labourTeamId,
                        description: prev.description,
                        vendor: prev.vendor,
                        amount: prev.amount,
                        billNumber: "",
                        milestoneId: prev.milestoneId,
                      }
                      const next =
                        typeof updater === "function" ? updater(current) : updater
                      return {
                        ...prev,
                        date: next.date,
                        category: next.category,
                        subcategory: next.subcategory,
                        labourTeamId: next.labourTeamId,
                        description: next.description,
                        vendor: next.vendor,
                        amount: next.amount,
                        milestoneId: next.milestoneId,
                      }
                    })
                  }}
                  categoryNames={props.categoryNames}
                  labourTeams={props.labourTeams}
                  subcategoriesForCategory={props.subcategoriesForCategory}
                  milestones={props.milestones}
                  canManageProjects={props.canManageProjects}
                  usesLabourCategory={usesLabourCategory}
                  splitMode={false}
                  setSplitMode={() => {}}
                  splitFirstAmount=""
                  setSplitFirstAmount={() => {}}
                  suggestedSplitGroup={null}
                  loadingOpenSplits={false}
                  isSubmitting={saving}
                  invoiceFile={null}
                  invoiceFileInputRef={{ current: null }}
                  handleInvoiceFileChange={() => {}}
                  handleUseSuggestedSplit={() => {}}
                  openSubcategoryManage={() => {}}
                  setCategoryManageOpen={() => {}}
                  bulkMode
                />
                <div className="mt-3 flex justify-end">
                  <MandatoryExpenseSubmitButton
                    onClick={addProjectLine}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add line
                  </MandatoryExpenseSubmitButton>
                </div>
              </MandatoryExpenseKeyboardProvider>
            )}

            {props.variant === "engineer" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={engineerActive.category}
                    onValueChange={(v) =>
                      setEngineerActive({ ...engineerActive, category: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENGINEER_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Milestone</Label>
                  <Select
                    value={engineerActive.milestoneId}
                    onValueChange={(v) =>
                      setEngineerActive({ ...engineerActive, milestoneId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select milestone" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.milestones.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description *</Label>
                  <Input
                    value={engineerActive.description}
                    onChange={(e) =>
                      setEngineerActive({
                        ...engineerActive,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    value={engineerActive.amount}
                    onChange={(e) =>
                      setEngineerActive({ ...engineerActive, amount: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        addEngineerLine()
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Input
                    value={engineerActive.vendor}
                    onChange={(e) =>
                      setEngineerActive({ ...engineerActive, vendor: e.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="button" className="gap-2" onClick={addEngineerLine}>
                    <Plus className="h-4 w-4" />
                    Add line
                  </Button>
                </div>
              </div>
            )}

            {props.variant === "company_expense" && (
              <FinanceActiveRow
                date={companyExpenseActive.date}
                category={companyExpenseActive.category}
                description={companyExpenseActive.description}
                amount={companyExpenseActive.amount}
                vendor={companyExpenseActive.vendor}
                categories={props.categories}
                onChange={(field, value) =>
                  setCompanyExpenseActive((prev) => ({ ...prev, [field]: value }))
                }
                onAddLine={addCompanyExpenseLine}
                showVendor
              />
            )}

            {props.variant === "company_income" && (
              <FinanceActiveRow
                date={companyIncomeActive.date}
                category={companyIncomeActive.category}
                description={companyIncomeActive.description}
                amount={companyIncomeActive.amount}
                source={companyIncomeActive.source}
                categories={props.categories}
                onChange={(field, value) =>
                  setCompanyIncomeActive((prev) => ({ ...prev, [field]: value }))
                }
                onAddLine={addCompanyIncomeLine}
                showSource
              />
            )}

            {props.variant === "personal_expense" && (
              <FinanceActiveRow
                date={personalActive.date}
                category={personalActive.category}
                description={personalActive.description}
                amount={personalActive.amount}
                categories={props.categories}
                onChange={(field, value) =>
                  setPersonalActive((prev) => ({ ...prev, [field]: value }))
                }
                onAddLine={addPersonalLine}
              />
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Completed lines ({completedCount})
            </p>
            <BulkEntryCompletedTable
              variant={props.variant}
              projectRows={projectCompleted}
              engineerRows={engineerCompleted}
              companyExpenseRows={companyExpenseCompleted}
              companyIncomeRows={companyIncomeCompleted}
              personalRows={personalCompleted}
              expenseCategories={
                props.variant === "project" ? props.expenseCategories : []
              }
              labourTeams={props.variant === "project" ? props.labourTeams : []}
              milestones={
                props.variant === "project" || props.variant === "engineer"
                  ? props.milestones
                  : []
              }
              onRemove={removeRow}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-6">
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
            disabled={saving || completedCount === 0}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FinanceActiveRow({
  date,
  category,
  description,
  amount,
  vendor,
  source,
  categories,
  onChange,
  onAddLine,
  showVendor,
  showSource,
}: {
  date: string
  category: string
  description: string
  amount: string
  vendor?: string
  source?: string
  categories: string[]
  onChange: (field: string, value: string) => void
  onAddLine: () => void
  showVendor?: boolean
  showSource?: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Date *</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => onChange("date", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Category *</Label>
        <Select value={category} onValueChange={(v) => onChange("category", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Description *</Label>
        <Input
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Amount *</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => onChange("amount", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onAddLine()
            }
          }}
        />
      </div>
      {showVendor && (
        <div className="space-y-2">
          <Label>Vendor</Label>
          <Input
            value={vendor ?? ""}
            onChange={(e) => onChange("vendor", e.target.value)}
          />
        </div>
      )}
      {showSource && (
        <div className="space-y-2">
          <Label>Source</Label>
          <Input
            value={source ?? ""}
            onChange={(e) => onChange("source", e.target.value)}
          />
        </div>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button type="button" className="gap-2" onClick={onAddLine}>
          <Plus className="h-4 w-4" />
          Add line
        </Button>
      </div>
    </div>
  )
}
