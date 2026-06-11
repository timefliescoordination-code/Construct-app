"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Loader2,
  Pencil,
  Trash2,
  User,
  Briefcase,
} from "lucide-react"
import { toast } from "sonner"
import { formatINR } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type {
  CompanyExpense,
  CompanyIncome,
  FinanceCategory,
  PersonalExpense,
} from "@/lib/types/database"
import type {
  AllExpensesOverview,
  ExpenseLayer,
  UnifiedMoneyRow,
} from "@/lib/finance/unified-money-feed"
import {
  createCompanyExpenseAction,
  createCompanyIncomeAction,
  createPersonalExpenseAction,
  deleteCompanyExpenseAction,
  deleteCompanyIncomeAction,
  deletePersonalExpenseAction,
  updateCompanyExpenseAction,
  updateCompanyIncomeAction,
  updatePersonalExpenseAction,
} from "@/lib/finance/finance-actions"
import { AddExpenseMenu, type ProjectOption } from "@/components/finance/add-expense-menu"
import { CategorySelectField } from "@/components/finance/category-select-field"
import { useExpenseShortcutRegistryOptional } from "@/lib/keyboard/expense-shortcut-context"
import { buildFinanceEntryFields } from "@/lib/keyboard/build-finance-mandatory-fields"
import {
  MandatoryExpenseKeyboardProvider,
  MandatoryExpenseSubmitButton,
  useMandatoryExpenseKeyboard,
} from "@/lib/keyboard/mandatory-expense-keyboard"
import { DashboardHeader } from "@/components/dashboard/header"
import {
  PageHeader,
  PageMain,
  PageShell,
} from "@/components/layout/page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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

type TabKey = "all" | "projects" | "company" | "personal"

const FINANCE_DIALOG_CLASS =
  "flex max-h-[min(92dvh,100dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
const FINANCE_FORM_ROW = "grid grid-cols-1 gap-3 sm:grid-cols-2"

type AllExpensesResponse = {
  rows: UnifiedMoneyRow[]
  total: number
  overview: AllExpensesOverview
  companyExpenses: CompanyExpense[]
  companyIncome: CompanyIncome[]
  personalExpenses: PersonalExpense[]
  projects: ProjectOption[]
  dateFrom: string
  dateTo: string
  setupWarning?: string
}

function buildQuery(
  period: string,
  layers: Record<ExpenseLayer, boolean>,
): string {
  const params = new URLSearchParams()
  params.set("period", period)
  const active = (["project", "company", "personal"] as ExpenseLayer[]).filter(
    (l) => layers[l],
  )
  if (active.length === 0) {
    params.set("layers", "")
  } else if (active.length < 3) {
    params.set("layers", active.join(","))
  }
  params.set("limit", "200")
  return params.toString()
}

async function fetchAllExpenses(query: string): Promise<AllExpensesResponse> {
  const res = await fetch(`/api/admin/all-expenses?${query}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? "Failed to load expenses")
  }
  return res.json()
}

type FinanceCategoriesResponse = {
  categories: {
    company_expense: FinanceCategory[]
    company_income: FinanceCategory[]
    personal_expense: FinanceCategory[]
  }
}

async function fetchFinanceCategories(): Promise<FinanceCategoriesResponse> {
  const res = await fetch("/api/admin/finance-categories")
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? "Failed to load categories")
  }
  return res.json()
}

function firstCategoryName(categories: FinanceCategory[]): string {
  return categories[0]?.name ?? ""
}

function layerLabel(layer: ExpenseLayer) {
  switch (layer) {
    case "project":
      return "Project"
    case "company":
      return "Company"
    case "personal":
      return "Personal"
  }
}

function LayerBadge({
  layer,
  direction,
}: {
  layer: ExpenseLayer
  direction: "in" | "out"
}) {
  const variant =
    layer === "project"
      ? "default"
      : layer === "company"
        ? "secondary"
        : "outline"
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={variant} className="text-[10px]">
        {layerLabel(layer)}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px]",
          direction === "in"
            ? "border-green-500/40 text-green-600"
            : "text-muted-foreground",
        )}
      >
        {direction === "in" ? "Income" : "Expense"}
      </Badge>
    </div>
  )
}

function OverviewCard({
  title,
  icon: Icon,
  totals,
  enabled,
  onToggle,
}: {
  title: string
  icon: typeof Briefcase
  totals: { expensesOut: number; incomeIn: number }
  enabled: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <Card className={cn(!enabled && "opacity-50")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Show ${title}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Spent: </span>
          <span className="font-semibold text-destructive">
            {formatINR(totals.expensesOut)}
          </span>
        </p>
        {title !== "Personal" ? (
          <p>
            <span className="text-muted-foreground">Income: </span>
            <span className="font-semibold text-green-600">
              {formatINR(totals.incomeIn)}
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function formatDate(date: string) {
  try {
    return format(new Date(date), "dd MMM yyyy")
  } catch {
    return date
  }
}

export function AllExpensesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const expenseShortcuts = useExpenseShortcutRegistryOptional()

  const tab = (searchParams.get("tab") as TabKey) || "all"
  const period = searchParams.get("period") ?? "30d"
  const shouldOpenAdd = searchParams.get("add") === "1"
  const shouldOpenAddIncome = searchParams.get("addIncome") === "1"

  const [layerToggles, setLayerToggles] = useState({
    project: searchParams.get("project") !== "0",
    company: searchParams.get("company") !== "0",
    personal: searchParams.get("personal") !== "0",
  })

  const syncUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      router.replace(`/admin/expenses?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const query = buildQuery(period, layerToggles)
  const { data, error, isLoading, mutate } = useSWR(
    `all-expenses-${query}`,
    () => fetchAllExpenses(query),
    { revalidateOnFocus: true },
  )

  const { data: categoriesData, mutate: mutateCategories } = useSWR(
    "finance-categories",
    fetchFinanceCategories,
    { revalidateOnFocus: true },
  )

  const companyExpenseCategories =
    categoriesData?.categories.company_expense ?? []
  const companyIncomeCategories = categoriesData?.categories.company_income ?? []
  const personalExpenseCategories =
    categoriesData?.categories.personal_expense ?? []

  const refreshCategories = () => void mutateCategories()

  const projects: ProjectOption[] = data?.projects ?? []

  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)
  const [companyIncomeDialogOpen, setCompanyIncomeDialogOpen] = useState(false)
  const [personalDialogOpen, setPersonalDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<CompanyExpense | null>(null)
  const [editingCompanyIncome, setEditingCompanyIncome] =
    useState<CompanyIncome | null>(null)
  const [editingPersonal, setEditingPersonal] = useState<PersonalExpense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "company-expense" | "company-income" | "personal"
    id: string
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const [companyForm, setCompanyForm] = useState({
    category: "",
    description: "",
    amount: "",
    vendorName: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "",
    notes: "",
  })

  const [companyIncomeForm, setCompanyIncomeForm] = useState({
    category: "",
    description: "",
    amount: "",
    sourceName: "",
    receivedDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "",
    referenceNumber: "",
    notes: "",
  })

  const [personalForm, setPersonalForm] = useState({
    category: "",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    notes: "",
  })

  useEffect(() => {
    if (companyExpenseCategories.length && !companyForm.category) {
      setCompanyForm((f) => ({
        ...f,
        category: firstCategoryName(companyExpenseCategories),
      }))
    }
    if (companyIncomeCategories.length && !companyIncomeForm.category) {
      setCompanyIncomeForm((f) => ({
        ...f,
        category: firstCategoryName(companyIncomeCategories),
      }))
    }
    if (personalExpenseCategories.length && !personalForm.category) {
      setPersonalForm((f) => ({
        ...f,
        category: firstCategoryName(personalExpenseCategories),
      }))
    }
  }, [
    companyExpenseCategories,
    companyIncomeCategories,
    personalExpenseCategories,
    companyForm.category,
    companyIncomeForm.category,
    personalForm.category,
  ])

  useEffect(() => {
    if (shouldOpenAdd && tab === "company") {
      setCompanyDialogOpen(true)
      syncUrl({ add: null })
    } else if (shouldOpenAddIncome && tab === "company") {
      setCompanyIncomeDialogOpen(true)
      syncUrl({ addIncome: null })
    } else if (shouldOpenAdd && tab === "personal") {
      setPersonalDialogOpen(true)
      syncUrl({ add: null })
    }
  }, [shouldOpenAdd, shouldOpenAddIncome, tab, syncUrl])

  const companyCategoryOptions = useMemo(
    () => companyExpenseCategories.map((c) => ({ value: c.name, label: c.name })),
    [companyExpenseCategories],
  )
  const companyIncomeCategoryOptions = useMemo(
    () => companyIncomeCategories.map((c) => ({ value: c.name, label: c.name })),
    [companyIncomeCategories],
  )
  const personalCategoryOptions = useMemo(
    () => personalExpenseCategories.map((c) => ({ value: c.name, label: c.name })),
    [personalExpenseCategories],
  )

  const companyMandatoryFields = useMemo(
    () =>
      buildFinanceEntryFields({
        categoryOptions: companyCategoryOptions,
        getCategory: () => companyForm.category,
        setCategory: (value) =>
          setCompanyForm((f) => ({ ...f, category: value })),
        getDescription: () => companyForm.description,
        getAmount: () => companyForm.amount,
      }),
    [
      companyCategoryOptions,
      companyForm.category,
      companyForm.description,
      companyForm.amount,
    ],
  )

  const companyIncomeMandatoryFields = useMemo(
    () =>
      buildFinanceEntryFields({
        categoryOptions: companyIncomeCategoryOptions,
        getCategory: () => companyIncomeForm.category,
        setCategory: (value) =>
          setCompanyIncomeForm((f) => ({ ...f, category: value })),
        getDescription: () => companyIncomeForm.description,
        getAmount: () => companyIncomeForm.amount,
      }),
    [
      companyIncomeCategoryOptions,
      companyIncomeForm.category,
      companyIncomeForm.description,
      companyIncomeForm.amount,
    ],
  )

  const personalMandatoryFields = useMemo(
    () =>
      buildFinanceEntryFields({
        categoryOptions: personalCategoryOptions,
        getCategory: () => personalForm.category,
        setCategory: (value) =>
          setPersonalForm((f) => ({ ...f, category: value })),
        getDescription: () => personalForm.description,
        getAmount: () => personalForm.amount,
      }),
    [
      personalCategoryOptions,
      personalForm.category,
      personalForm.description,
      personalForm.amount,
    ],
  )

  const projectRows = useMemo(
    () => (data?.rows ?? []).filter((r) => r.layer === "project"),
    [data?.rows],
  )

  const syncCategoryFields = useCallback(() => {
    const ce = companyExpenseCategories.map((c) => c.name)
    const ci = companyIncomeCategories.map((c) => c.name)
    const pe = personalExpenseCategories.map((c) => c.name)
    setCompanyForm((f) => ({
      ...f,
      category: ce.includes(f.category) ? f.category : firstCategoryName(companyExpenseCategories),
    }))
    setCompanyIncomeForm((f) => ({
      ...f,
      category: ci.includes(f.category) ? f.category : firstCategoryName(companyIncomeCategories),
    }))
    setPersonalForm((f) => ({
      ...f,
      category: pe.includes(f.category) ? f.category : firstCategoryName(personalExpenseCategories),
    }))
  }, [
    companyExpenseCategories,
    companyIncomeCategories,
    personalExpenseCategories,
  ])

  const resetCompanyForm = () => {
    setEditingCompany(null)
    setCompanyForm({
      category: firstCategoryName(companyExpenseCategories),
      description: "",
      amount: "",
      vendorName: "",
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "",
      notes: "",
    })
  }

  const resetPersonalForm = () => {
    setEditingPersonal(null)
    setPersonalForm({
      category: firstCategoryName(personalExpenseCategories),
      description: "",
      amount: "",
      expenseDate: new Date().toISOString().slice(0, 10),
      notes: "",
    })
  }

  const openEditCompany = (row: CompanyExpense) => {
    setEditingCompany(row)
    setCompanyForm({
      category: row.category,
      description: row.description,
      amount: String(row.amount),
      vendorName: row.vendor_name ?? "",
      expenseDate: row.expense_date,
      paymentMethod: row.payment_method ?? "",
      notes: row.notes ?? "",
    })
    setCompanyDialogOpen(true)
  }

  const resetCompanyIncomeForm = () => {
    setEditingCompanyIncome(null)
    setCompanyIncomeForm({
      category: firstCategoryName(companyIncomeCategories),
      description: "",
      amount: "",
      sourceName: "",
      receivedDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "",
      referenceNumber: "",
      notes: "",
    })
  }

  useEffect(() => {
    if (!expenseShortcuts) return
    const unregisterCompany = expenseShortcuts.registerCompanyExpense(() => {
      resetCompanyForm()
      setCompanyDialogOpen(true)
    })
    const unregisterIncome = expenseShortcuts.registerCompanyIncome(() => {
      resetCompanyIncomeForm()
      setCompanyIncomeDialogOpen(true)
    })
    const unregisterPersonal = expenseShortcuts.registerPersonalExpense(() => {
      resetPersonalForm()
      setPersonalDialogOpen(true)
    })
    return () => {
      unregisterCompany()
      unregisterIncome()
      unregisterPersonal()
    }
  }, [expenseShortcuts, companyExpenseCategories, companyIncomeCategories, personalExpenseCategories])

  const openEditCompanyIncome = (row: CompanyIncome) => {
    setEditingCompanyIncome(row)
    setCompanyIncomeForm({
      category: row.category,
      description: row.description,
      amount: String(row.amount),
      sourceName: row.source_name ?? "",
      receivedDate: row.received_date,
      paymentMethod: row.payment_method ?? "",
      referenceNumber: row.reference_number ?? "",
      notes: row.notes ?? "",
    })
    setCompanyIncomeDialogOpen(true)
  }

  const openEditPersonal = (row: PersonalExpense) => {
    setEditingPersonal(row)
    setPersonalForm({
      category: row.category,
      description: row.description,
      amount: String(row.amount),
      expenseDate: row.expense_date,
      notes: row.notes ?? "",
    })
    setPersonalDialogOpen(true)
  }

  const saveCompany = async () => {
    const amount = Number(companyForm.amount)
    if (!companyForm.category) {
      toast.error("Select a category.")
      return
    }
    if (!companyForm.description.trim() || !Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid description and amount.")
      return
    }
    setSaving(true)
    const payload = {
      category: companyForm.category,
      description: companyForm.description.trim(),
      amount,
      vendorName: companyForm.vendorName.trim() || null,
      expenseDate: companyForm.expenseDate,
      paymentMethod: companyForm.paymentMethod.trim() || null,
      notes: companyForm.notes.trim() || null,
    }
    const result = editingCompany
      ? await updateCompanyExpenseAction({ id: editingCompany.id, ...payload })
      : await createCompanyExpenseAction(payload)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editingCompany ? "Company expense updated" : "Company expense added")
    setCompanyDialogOpen(false)
    resetCompanyForm()
    void mutate()
  }

  const saveCompanyIncome = async () => {
    const amount = Number(companyIncomeForm.amount)
    if (!companyIncomeForm.category) {
      toast.error("Select a category.")
      return
    }
    if (
      !companyIncomeForm.description.trim() ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      toast.error("Enter a valid description and amount.")
      return
    }
    setSaving(true)
    const payload = {
      category: companyIncomeForm.category,
      description: companyIncomeForm.description.trim(),
      amount,
      sourceName: companyIncomeForm.sourceName.trim() || null,
      receivedDate: companyIncomeForm.receivedDate,
      paymentMethod: companyIncomeForm.paymentMethod.trim() || null,
      referenceNumber: companyIncomeForm.referenceNumber.trim() || null,
      notes: companyIncomeForm.notes.trim() || null,
    }
    const result = editingCompanyIncome
      ? await updateCompanyIncomeAction({
          id: editingCompanyIncome.id,
          ...payload,
        })
      : await createCompanyIncomeAction(payload)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(
      editingCompanyIncome ? "Company income updated" : "Company income added",
    )
    setCompanyIncomeDialogOpen(false)
    resetCompanyIncomeForm()
    void mutate()
  }

  const savePersonal = async () => {
    const amount = Number(personalForm.amount)
    if (!personalForm.category) {
      toast.error("Select a category.")
      return
    }
    if (!personalForm.description.trim() || !Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid description and amount.")
      return
    }
    setSaving(true)
    const payload = {
      category: personalForm.category,
      description: personalForm.description.trim(),
      amount,
      expenseDate: personalForm.expenseDate,
      notes: personalForm.notes.trim() || null,
    }
    const result = editingPersonal
      ? await updatePersonalExpenseAction({ id: editingPersonal.id, ...payload })
      : await createPersonalExpenseAction(payload)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editingPersonal ? "Personal expense updated" : "Personal expense added")
    setPersonalDialogOpen(false)
    resetPersonalForm()
    void mutate()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    const result =
      deleteTarget.type === "company-expense"
        ? await deleteCompanyExpenseAction(deleteTarget.id)
        : deleteTarget.type === "company-income"
          ? await deleteCompanyIncomeAction(deleteTarget.id)
          : await deletePersonalExpenseAction(deleteTarget.id)
    setSaving(false)
    setDeleteTarget(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Deleted")
    void mutate()
  }

  const overview = data?.overview ?? {
    project: { expensesOut: 0, incomeIn: 0 },
    company: { expensesOut: 0, incomeIn: 0 },
    personal: { expensesOut: 0, incomeIn: 0 },
  }

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="All expenses"
          description="Project, company, and personal spending in one place — toggle layers and view income with expenses."
        >
          <Select
            value={period}
            onValueChange={(v) => syncUrl({ period: v })}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <AddExpenseMenu projects={projects} />
        </PageHeader>

        {error ? (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error.message}
          </div>
        ) : null}

        {!error && data?.setupWarning ? (
          <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            {data.setupWarning}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {isLoading ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : (
            <>
              <OverviewCard
                title="Projects"
                icon={Briefcase}
                totals={overview.project}
                enabled={layerToggles.project}
                onToggle={(v) => {
                  if (!v && !layerToggles.company && !layerToggles.personal) {
                    toast.message("Keep at least one layer visible")
                    return
                  }
                  setLayerToggles((t) => ({ ...t, project: v }))
                  syncUrl({ project: v ? null : "0" })
                }}
              />
              <OverviewCard
                title="Company"
                icon={Building2}
                totals={overview.company}
                enabled={layerToggles.company}
                onToggle={(v) => {
                  if (!v && !layerToggles.project && !layerToggles.personal) {
                    toast.message("Keep at least one layer visible")
                    return
                  }
                  setLayerToggles((t) => ({ ...t, company: v }))
                  syncUrl({ company: v ? null : "0" })
                }}
              />
              <OverviewCard
                title="Personal"
                icon={User}
                totals={overview.personal}
                enabled={layerToggles.personal}
                onToggle={(v) => {
                  if (!v && !layerToggles.project && !layerToggles.company) {
                    toast.message("Keep at least one layer visible")
                    return
                  }
                  setLayerToggles((t) => ({ ...t, personal: v }))
                  syncUrl({ personal: v ? null : "0" })
                }}
              />
            </>
          )}
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => syncUrl({ tab: v })}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (data?.rows ?? []).length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground text-center">
                    No entries for this period. Turn on a layer above or add an expense.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.rows ?? []).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(row.date)}
                          </TableCell>
                          <TableCell>
                            <LayerBadge layer={row.layer} direction={row.direction} />
                          </TableCell>
                          <TableCell>
                            {row.linkHref ? (
                              <Link
                                href={row.linkHref}
                                className="hover:underline text-foreground"
                              >
                                {row.description}
                              </Link>
                            ) : (
                              row.description
                            )}
                            {row.projectName ? (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {row.projectName}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                row.direction === "in"
                                  ? "text-green-600"
                                  : "text-foreground",
                              )}
                            >
                              {row.direction === "in" ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              )}
                              {formatINR(row.amount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project expenses & income</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {projectRows.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground text-center">
                    No project activity in this period.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{formatDate(row.date)}</TableCell>
                          <TableCell>{row.projectName}</TableCell>
                          <TableCell>
                            <LayerBadge layer="project" direction={row.direction} />
                            <span className="block mt-1">{row.description}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.linkHref ? (
                              <Link href={row.linkHref} className="hover:underline">
                                {formatINR(row.amount)}
                              </Link>
                            ) : (
                              formatINR(row.amount)
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company" className="space-y-6">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetCompanyForm()
                  setCompanyDialogOpen(true)
                }}
              >
                Add company expense
              </Button>
              <Button
                onClick={() => {
                  resetCompanyIncomeForm()
                  setCompanyIncomeDialogOpen(true)
                }}
              >
                Add company income
              </Button>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompanyPersonalTable
                  rows={data?.companyExpenses ?? []}
                  isLoading={isLoading}
                  type="company"
                  onEdit={openEditCompany}
                  onDelete={(id) =>
                    setDeleteTarget({ type: "company-expense", id })
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">
                  Income
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompanyIncomeTable
                  rows={data?.companyIncome ?? []}
                  isLoading={isLoading}
                  onEdit={openEditCompanyIncome}
                  onDelete={(id) =>
                    setDeleteTarget({ type: "company-income", id })
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personal">
            <div className="flex justify-end mb-3">
              <Button
                onClick={() => {
                  resetPersonalForm()
                  setPersonalDialogOpen(true)
                }}
              >
                Add personal expense
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <CompanyPersonalTable
                  rows={data?.personalExpenses ?? []}
                  isLoading={isLoading}
                  type="personal"
                  onEdit={openEditPersonal}
                  onDelete={(id) => setDeleteTarget({ type: "personal", id })}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={companyDialogOpen}
          onOpenChange={(open) => {
            setCompanyDialogOpen(open)
            if (!open) resetCompanyForm()
          }}
        >
          <DialogContent className={FINANCE_DIALOG_CLASS}>
            <MandatoryExpenseKeyboardProvider
              enabled={companyDialogOpen && !editingCompany}
              fields={companyMandatoryFields}
              onSubmit={() => void saveCompany()}
              autoAdvanceSelectOnLetter
            >
              <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
                <DialogTitle>
                  {editingCompany ? "Edit company expense" : "Add company expense"}
                </DialogTitle>
              </DialogHeader>
              <CompanyExpenseFormFields
                companyForm={companyForm}
                setCompanyForm={setCompanyForm}
                companyExpenseCategories={companyExpenseCategories}
                refreshCategories={refreshCategories}
                syncCategoryFields={syncCategoryFields}
              />
              <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
                {editingCompany ? (
                  <Button onClick={() => void saveCompany()} disabled={saving} className="w-full sm:w-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                ) : (
                  <MandatoryExpenseSubmitButton
                    onClick={() => void saveCompany()}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </MandatoryExpenseSubmitButton>
                )}
              </DialogFooter>
            </MandatoryExpenseKeyboardProvider>
          </DialogContent>
        </Dialog>

        <Dialog
          open={companyIncomeDialogOpen}
          onOpenChange={(open) => {
            setCompanyIncomeDialogOpen(open)
            if (!open) resetCompanyIncomeForm()
          }}
        >
          <DialogContent className={FINANCE_DIALOG_CLASS}>
            <MandatoryExpenseKeyboardProvider
              enabled={companyIncomeDialogOpen && !editingCompanyIncome}
              fields={companyIncomeMandatoryFields}
              onSubmit={() => void saveCompanyIncome()}
              autoAdvanceSelectOnLetter
            >
              <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
                <DialogTitle>
                  {editingCompanyIncome
                    ? "Edit company income"
                    : "Add company income"}
                </DialogTitle>
              </DialogHeader>
              <CompanyIncomeFormFields
                companyIncomeForm={companyIncomeForm}
                setCompanyIncomeForm={setCompanyIncomeForm}
                companyIncomeCategories={companyIncomeCategories}
                refreshCategories={refreshCategories}
                syncCategoryFields={syncCategoryFields}
              />
              <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
                {editingCompanyIncome ? (
                  <Button
                    onClick={() => void saveCompanyIncome()}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                ) : (
                  <MandatoryExpenseSubmitButton
                    onClick={() => void saveCompanyIncome()}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </MandatoryExpenseSubmitButton>
                )}
              </DialogFooter>
            </MandatoryExpenseKeyboardProvider>
          </DialogContent>
        </Dialog>

        <Dialog
          open={personalDialogOpen}
          onOpenChange={(open) => {
            setPersonalDialogOpen(open)
            if (!open) resetPersonalForm()
          }}
        >
          <DialogContent className={FINANCE_DIALOG_CLASS}>
            <MandatoryExpenseKeyboardProvider
              enabled={personalDialogOpen && !editingPersonal}
              fields={personalMandatoryFields}
              onSubmit={() => void savePersonal()}
              autoAdvanceSelectOnLetter
            >
              <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
                <DialogTitle>
                  {editingPersonal ? "Edit personal expense" : "Add personal expense"}
                </DialogTitle>
              </DialogHeader>
              <PersonalExpenseFormFields
                personalForm={personalForm}
                setPersonalForm={setPersonalForm}
                personalExpenseCategories={personalExpenseCategories}
                refreshCategories={refreshCategories}
                syncCategoryFields={syncCategoryFields}
              />
              <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
                {editingPersonal ? (
                  <Button onClick={() => void savePersonal()} disabled={saving} className="w-full sm:w-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                ) : (
                  <MandatoryExpenseSubmitButton
                    onClick={() => void savePersonal()}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </MandatoryExpenseSubmitButton>
                )}
              </DialogFooter>
            </MandatoryExpenseKeyboardProvider>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void confirmDelete()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageMain>
    </PageShell>
  )
}

function CompanyPersonalTable({
  rows,
  isLoading,
  type,
  onEdit,
  onDelete,
}: {
  rows: (CompanyExpense | PersonalExpense)[]
  isLoading: boolean
  type: "company" | "personal"
  onEdit: (row: CompanyExpense | PersonalExpense) => void
  onDelete: (id: string) => void
}) {
  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground text-center">
        No {type} expenses in this period.
      </p>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{formatDate(row.expense_date)}</TableCell>
            <TableCell>{row.category}</TableCell>
            <TableCell>{row.description}</TableCell>
            <TableCell className="text-right">{formatINR(row.amount)}</TableCell>
            <TableCell>
              <div className="flex gap-1 justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(row)}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(row.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CompanyIncomeTable({
  rows,
  isLoading,
  onEdit,
  onDelete,
}: {
  rows: CompanyIncome[]
  isLoading: boolean
  onEdit: (row: CompanyIncome) => void
  onDelete: (id: string) => void
}) {
  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground text-center">
        No company income in this period.
      </p>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{formatDate(row.received_date)}</TableCell>
            <TableCell>{row.category}</TableCell>
            <TableCell>{row.description}</TableCell>
            <TableCell className="text-muted-foreground">
              {row.source_name ?? "—"}
            </TableCell>
            <TableCell className="text-right font-medium text-green-600">
              {formatINR(row.amount)}
            </TableCell>
            <TableCell>
              <div className="flex gap-1 justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(row)}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(row.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

type CompanyFormState = {
  category: string
  description: string
  amount: string
  vendorName: string
  expenseDate: string
  paymentMethod: string
  notes: string
}

function CompanyExpenseFormFields({
  companyForm,
  setCompanyForm,
  companyExpenseCategories,
  refreshCategories,
  syncCategoryFields,
}: {
  companyForm: CompanyFormState
  setCompanyForm: React.Dispatch<React.SetStateAction<CompanyFormState>>
  companyExpenseCategories: FinanceCategory[]
  refreshCategories: () => void
  syncCategoryFields: () => void
}) {
  const kb = useMandatoryExpenseKeyboard()
  const dateBind = kb?.bindDate("date")
  const categoryBind = kb?.bindSelect("category")
  const descriptionBind = kb?.bindText("description")
  const amountBind = kb?.bindText("amount")

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input
            type="date"
            value={companyForm.expenseDate}
            onChange={(e) =>
              setCompanyForm((f) => ({ ...f, expenseDate: e.target.value }))
            }
            ref={dateBind?.ref}
            onKeyDown={dateBind?.onKeyDown}
          />
        </div>
        <CategorySelectField
          kind="company_expense"
          value={companyForm.category}
          onValueChange={(v) => setCompanyForm((f) => ({ ...f, category: v }))}
          categories={companyExpenseCategories}
          onCategoriesChange={() => {
            refreshCategories()
            syncCategoryFields()
          }}
          selectOpen={categoryBind?.open}
          onSelectOpenChange={categoryBind?.onOpenChange}
          onTriggerKeyDown={categoryBind?.onTriggerKeyDown}
          triggerRef={categoryBind?.triggerRef}
        />
        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={companyForm.description}
            onChange={(e) =>
              setCompanyForm((f) => ({ ...f, description: e.target.value }))
            }
            ref={descriptionBind?.ref}
            onKeyDown={descriptionBind?.onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            type="number"
            min={0}
            value={companyForm.amount}
            onChange={(e) =>
              setCompanyForm((f) => ({ ...f, amount: e.target.value }))
            }
            ref={amountBind?.ref}
            onKeyDown={amountBind?.onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label>Vendor (optional)</Label>
          <Input
            value={companyForm.vendorName}
            onChange={(e) =>
              setCompanyForm((f) => ({ ...f, vendorName: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            value={companyForm.notes}
            onChange={(e) =>
              setCompanyForm((f) => ({ ...f, notes: e.target.value }))
            }
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}

type CompanyIncomeFormState = {
  category: string
  description: string
  amount: string
  sourceName: string
  receivedDate: string
  paymentMethod: string
  referenceNumber: string
  notes: string
}

function CompanyIncomeFormFields({
  companyIncomeForm,
  setCompanyIncomeForm,
  companyIncomeCategories,
  refreshCategories,
  syncCategoryFields,
}: {
  companyIncomeForm: CompanyIncomeFormState
  setCompanyIncomeForm: React.Dispatch<React.SetStateAction<CompanyIncomeFormState>>
  companyIncomeCategories: FinanceCategory[]
  refreshCategories: () => void
  syncCategoryFields: () => void
}) {
  const kb = useMandatoryExpenseKeyboard()
  const dateBind = kb?.bindDate("date")
  const categoryBind = kb?.bindSelect("category")
  const descriptionBind = kb?.bindText("description")
  const amountBind = kb?.bindText("amount")

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Received date</Label>
          <Input
            type="date"
            value={companyIncomeForm.receivedDate}
            onChange={(e) =>
              setCompanyIncomeForm((f) => ({ ...f, receivedDate: e.target.value }))
            }
            ref={dateBind?.ref}
            onKeyDown={dateBind?.onKeyDown}
          />
        </div>
        <CategorySelectField
          kind="company_income"
          value={companyIncomeForm.category}
          onValueChange={(v) =>
            setCompanyIncomeForm((f) => ({ ...f, category: v }))
          }
          categories={companyIncomeCategories}
          onCategoriesChange={() => {
            refreshCategories()
            syncCategoryFields()
          }}
          selectOpen={categoryBind?.open}
          onSelectOpenChange={categoryBind?.onOpenChange}
          onTriggerKeyDown={categoryBind?.onTriggerKeyDown}
          triggerRef={categoryBind?.triggerRef}
        />
        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={companyIncomeForm.description}
            onChange={(e) =>
              setCompanyIncomeForm((f) => ({
                ...f,
                description: e.target.value,
              }))
            }
            ref={descriptionBind?.ref}
            onKeyDown={descriptionBind?.onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            type="number"
            min={0}
            value={companyIncomeForm.amount}
            onChange={(e) =>
              setCompanyIncomeForm((f) => ({ ...f, amount: e.target.value }))
            }
            ref={amountBind?.ref}
            onKeyDown={amountBind?.onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label>Source / payer (optional)</Label>
          <Input
            value={companyIncomeForm.sourceName}
            onChange={(e) =>
              setCompanyIncomeForm((f) => ({
                ...f,
                sourceName: e.target.value,
              }))
            }
            placeholder="Who paid?"
          />
        </div>
        <div className={FINANCE_FORM_ROW}>
          <div className="space-y-2">
            <Label>Payment method (optional)</Label>
            <Input
              value={companyIncomeForm.paymentMethod}
              onChange={(e) =>
                setCompanyIncomeForm((f) => ({
                  ...f,
                  paymentMethod: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Reference # (optional)</Label>
            <Input
              value={companyIncomeForm.referenceNumber}
              onChange={(e) =>
                setCompanyIncomeForm((f) => ({
                  ...f,
                  referenceNumber: e.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            value={companyIncomeForm.notes}
            onChange={(e) =>
              setCompanyIncomeForm((f) => ({ ...f, notes: e.target.value }))
            }
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}

type PersonalFormState = {
  category: string
  description: string
  amount: string
  expenseDate: string
  notes: string
}

function PersonalExpenseFormFields({
  personalForm,
  setPersonalForm,
  personalExpenseCategories,
  refreshCategories,
  syncCategoryFields,
}: {
  personalForm: PersonalFormState
  setPersonalForm: React.Dispatch<React.SetStateAction<PersonalFormState>>
  personalExpenseCategories: FinanceCategory[]
  refreshCategories: () => void
  syncCategoryFields: () => void
}) {
  const kb = useMandatoryExpenseKeyboard()
  const dateBind = kb?.bindDate("date")
  const categoryBind = kb?.bindSelect("category")
  const descriptionBind = kb?.bindText("description")
  const amountBind = kb?.bindText("amount")

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input
            type="date"
            value={personalForm.expenseDate}
            onChange={(e) =>
              setPersonalForm((f) => ({ ...f, expenseDate: e.target.value }))
            }
            ref={dateBind?.ref}
            onKeyDown={dateBind?.onKeyDown}
          />
        </div>
        <CategorySelectField
          kind="personal_expense"
          value={personalForm.category}
          onValueChange={(v) => setPersonalForm((f) => ({ ...f, category: v }))}
          categories={personalExpenseCategories}
          onCategoriesChange={() => {
            refreshCategories()
            syncCategoryFields()
          }}
          selectOpen={categoryBind?.open}
          onSelectOpenChange={categoryBind?.onOpenChange}
          onTriggerKeyDown={categoryBind?.onTriggerKeyDown}
          triggerRef={categoryBind?.triggerRef}
        />
        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={personalForm.description}
            onChange={(e) =>
              setPersonalForm((f) => ({ ...f, description: e.target.value }))
            }
            ref={descriptionBind?.ref}
            onKeyDown={descriptionBind?.onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            type="number"
            min={0}
            value={personalForm.amount}
            onChange={(e) =>
              setPersonalForm((f) => ({ ...f, amount: e.target.value }))
            }
            ref={amountBind?.ref}
            onKeyDown={amountBind?.onKeyDown}
          />
        </div>
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            value={personalForm.notes}
            onChange={(e) =>
              setPersonalForm((f) => ({ ...f, notes: e.target.value }))
            }
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}
