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
  PersonalExpense,
} from "@/lib/types/database"
import type {
  AllExpensesOverview,
  ExpenseLayer,
  UnifiedMoneyRow,
} from "@/lib/finance/unified-money-feed"
import {
  COMPANY_EXPENSE_CATEGORIES,
  PERSONAL_EXPENSE_CATEGORIES,
} from "@/lib/finance/categories"
import {
  createCompanyExpenseAction,
  createPersonalExpenseAction,
  deleteCompanyExpenseAction,
  deletePersonalExpenseAction,
  updateCompanyExpenseAction,
  updatePersonalExpenseAction,
} from "@/lib/finance/finance-actions"
import { AddExpenseMenu, type ProjectOption } from "@/components/finance/add-expense-menu"
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

type AllExpensesResponse = {
  rows: UnifiedMoneyRow[]
  total: number
  overview: AllExpensesOverview
  companyExpenses: CompanyExpense[]
  personalExpenses: PersonalExpense[]
  projects: ProjectOption[]
  dateFrom: string
  dateTo: string
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

  const tab = (searchParams.get("tab") as TabKey) || "all"
  const period = searchParams.get("period") ?? "30d"
  const shouldOpenAdd = searchParams.get("add") === "1"

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

  const projects: ProjectOption[] = data?.projects ?? []

  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)
  const [personalDialogOpen, setPersonalDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<CompanyExpense | null>(null)
  const [editingPersonal, setEditingPersonal] = useState<PersonalExpense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "company" | "personal"
    id: string
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const [companyForm, setCompanyForm] = useState({
    category: COMPANY_EXPENSE_CATEGORIES[0],
    description: "",
    amount: "",
    vendorName: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "",
    notes: "",
  })

  const [personalForm, setPersonalForm] = useState({
    category: PERSONAL_EXPENSE_CATEGORIES[0],
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    notes: "",
  })

  useEffect(() => {
    if (!shouldOpenAdd) return
    if (tab === "company") {
      setCompanyDialogOpen(true)
      syncUrl({ add: null })
    } else if (tab === "personal") {
      setPersonalDialogOpen(true)
      syncUrl({ add: null })
    }
  }, [shouldOpenAdd, tab, syncUrl])

  const projectRows = useMemo(
    () => (data?.rows ?? []).filter((r) => r.layer === "project"),
    [data?.rows],
  )

  const resetCompanyForm = () => {
    setEditingCompany(null)
    setCompanyForm({
      category: COMPANY_EXPENSE_CATEGORIES[0],
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
      category: PERSONAL_EXPENSE_CATEGORIES[0],
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

  const savePersonal = async () => {
    const amount = Number(personalForm.amount)
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
      deleteTarget.type === "company"
        ? await deleteCompanyExpenseAction(deleteTarget.id)
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

          <TabsContent value="company">
            <div className="flex justify-end mb-3">
              <Button
                onClick={() => {
                  resetCompanyForm()
                  setCompanyDialogOpen(true)
                }}
              >
                Add company expense
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <CompanyPersonalTable
                  rows={data?.companyExpenses ?? []}
                  isLoading={isLoading}
                  type="company"
                  onEdit={openEditCompany}
                  onDelete={(id) => setDeleteTarget({ type: "company", id })}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? "Edit company expense" : "Add company expense"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={companyForm.category}
                  onValueChange={(v) =>
                    setCompanyForm((f) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={companyForm.description}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={companyForm.amount}
                    onChange={(e) =>
                      setCompanyForm((f) => ({ ...f, amount: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={companyForm.expenseDate}
                    onChange={(e) =>
                      setCompanyForm((f) => ({ ...f, expenseDate: e.target.value }))
                    }
                  />
                </div>
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
              <Button onClick={() => void saveCompany()} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={personalDialogOpen}
          onOpenChange={(open) => {
            setPersonalDialogOpen(open)
            if (!open) resetPersonalForm()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPersonal ? "Edit personal expense" : "Add personal expense"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={personalForm.category}
                  onValueChange={(v) =>
                    setPersonalForm((f) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAL_EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={personalForm.description}
                  onChange={(e) =>
                    setPersonalForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={personalForm.amount}
                    onChange={(e) =>
                      setPersonalForm((f) => ({ ...f, amount: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={personalForm.expenseDate}
                    onChange={(e) =>
                      setPersonalForm((f) => ({ ...f, expenseDate: e.target.value }))
                    }
                  />
                </div>
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
              <Button onClick={() => void savePersonal()} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete expense?</AlertDialogTitle>
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
