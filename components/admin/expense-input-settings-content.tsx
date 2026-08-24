"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Tags,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageHeader, PageMain, PageShell } from "@/components/layout/page"
import { useAuth } from "@/lib/hooks/use-auth"
import type { ExpenseCategoryView } from "@/lib/data/expense-categories"
import {
  createExpenseInputCategoryAction,
  createExpenseInputSubcategoryAction,
  deleteExpenseInputCategoryAction,
  deleteExpenseInputSubcategoryAction,
  getExpenseInputCatalogAction,
  updateExpenseInputCategoryAction,
  updateExpenseInputSubcategoryAction,
} from "@/lib/expense-input/actions"
import {
  createFinanceCategoryAction,
  deleteFinanceCategoryAction,
  updateFinanceCategoryAction,
} from "@/lib/finance/finance-category-actions"
import type { FinanceCategory, FinanceCategoryKind } from "@/lib/types/database"

const FINANCE_TABS: { kind: FinanceCategoryKind; label: string }[] = [
  { kind: "company_expense", label: "Company expenses" },
  { kind: "personal_expense", label: "Personal expenses" },
  { kind: "company_income", label: "Company income" },
]

export function ExpenseInputSettingsContent() {
  const router = useRouter()
  const { isAdmin, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<ExpenseCategoryView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryLabour, setNewCategoryLabour] = useState(false)
  const [newSubName, setNewSubName] = useState("")
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [editingSubName, setEditingSubName] = useState("")
  const [financeByKind, setFinanceByKind] = useState<
    Record<FinanceCategoryKind, FinanceCategory[]>
  >({
    company_expense: [],
    company_income: [],
    personal_expense: [],
  })
  const [newFinanceName, setNewFinanceName] = useState<Record<FinanceCategoryKind, string>>({
    company_expense: "",
    company_income: "",
    personal_expense: "",
  })

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/login")
    }
  }, [authLoading, isAdmin, router])

  const loadCatalog = useCallback(async () => {
    const result = await getExpenseInputCatalogAction()
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setCategories(result.data.categories)
    setSelectedId((current) => {
      if (current && result.data.categories.some((c) => c.id === current)) {
        return current
      }
      return result.data.categories[0]?.id ?? null
    })
  }, [])

  const loadFinance = useCallback(async () => {
    const res = await fetch("/api/management/finance-categories", {
      credentials: "include",
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as {
      categories?: Record<string, FinanceCategory[]>
      error?: string
    }
    if (!res.ok) {
      toast.error(json.error ?? "Failed to load finance categories.")
      return
    }
    setFinanceByKind({
      company_expense: json.categories?.company_expense ?? [],
      company_income: json.categories?.company_income ?? [],
      personal_expense: json.categories?.personal_expense ?? [],
    })
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadCatalog(), loadFinance()])
    setLoading(false)
  }, [loadCatalog, loadFinance])

  useEffect(() => {
    if (isAdmin) void loadAll()
  }, [isAdmin, loadAll])

  const selected = categories.find((c) => c.id === selectedId) ?? null

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required.")
      return
    }
    setSaving(true)
    const result = await createExpenseInputCategoryAction({
      name: newCategoryName,
      usesLabourTeams: newCategoryLabour,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category added for upcoming expenses.")
    setNewCategoryName("")
    setNewCategoryLabour(false)
    setSelectedId(result.data.id)
    await loadCatalog()
  }

  const handleSaveCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return
    setSaving(true)
    const result = await updateExpenseInputCategoryAction({
      categoryId: editingCategoryId,
      name: editingCategoryName,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category updated. Existing expenses keep their original names.")
    setEditingCategoryId(null)
    await loadCatalog()
  }

  const handleToggleLabour = async (category: ExpenseCategoryView, value: boolean) => {
    setSaving(true)
    const result = await updateExpenseInputCategoryAction({
      categoryId: category.id,
      name: category.name,
      usesLabourTeams: value,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    await loadCatalog()
  }

  const handleDeleteCategory = async (id: string) => {
    setSaving(true)
    const result = await deleteExpenseInputCategoryAction({ categoryId: id })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Removed from upcoming expense forms. Existing expenses are unchanged.")
    if (selectedId === id) setSelectedId(null)
    await loadCatalog()
  }

  const handleAddSub = async () => {
    if (!selected) return
    if (!newSubName.trim()) {
      toast.error("Subcategory name is required.")
      return
    }
    setSaving(true)
    const result = await createExpenseInputSubcategoryAction({
      categoryId: selected.id,
      name: newSubName,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Subcategory added for upcoming expenses.")
    setNewSubName("")
    await loadCatalog()
  }

  const handleSaveSub = async () => {
    if (!editingSubId || !editingSubName.trim()) return
    setSaving(true)
    const result = await updateExpenseInputSubcategoryAction({
      subcategoryId: editingSubId,
      name: editingSubName,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Subcategory updated. Existing expenses keep their original names.")
    setEditingSubId(null)
    await loadCatalog()
  }

  const handleDeleteSub = async (id: string) => {
    setSaving(true)
    const result = await deleteExpenseInputSubcategoryAction({ subcategoryId: id })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Removed from upcoming expense forms. Existing expenses are unchanged.")
    await loadCatalog()
  }

  const handleAddFinance = async (kind: FinanceCategoryKind) => {
    const name = newFinanceName[kind]
    if (!name.trim()) {
      toast.error("Category name is required.")
      return
    }
    setSaving(true)
    const result = await createFinanceCategoryAction({ kind, name })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Category added for upcoming entries.")
    setNewFinanceName((prev) => ({ ...prev, [kind]: "" }))
    await loadFinance()
  }

  const handleSaveFinance = async (kind: FinanceCategoryKind, id: string, name: string) => {
    setSaving(true)
    const result = await updateFinanceCategoryAction({ id, kind, name })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Updated. Existing entries keep their original category name.")
    setEditingCategoryId(null)
    await loadFinance()
  }

  const handleDeleteFinance = async (kind: FinanceCategoryKind, id: string) => {
    setSaving(true)
    const result = await deleteFinanceCategoryAction({ id, kind })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Removed from upcoming forms. Existing entries are unchanged.")
    await loadFinance()
  }

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Manage expense input"
          description="Master list of categories and subcategories for new expenses. Changing this list does not rewrite past entries."
        >
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin" aria-label="Back to admin dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </PageHeader>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="project">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="project">Project expenses</TabsTrigger>
              {FINANCE_TABS.map((tab) => (
                <TabsTrigger key={tab.kind} value={tab.kind}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="project" className="mt-4">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="section-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tags className="h-5 w-5" />
                      Categories
                    </CardTitle>
                    <CardDescription>
                      These names appear on Add Expense for every project.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border p-2">
                      {categories.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No categories yet.
                        </p>
                      ) : (
                        categories.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => setSelectedId(category.id)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${
                              selectedId === category.id
                                ? "bg-primary/10 ring-1 ring-primary/30"
                                : "bg-muted/40 hover:bg-muted"
                            }`}
                          >
                            {editingCategoryId === category.id ? (
                              <Input
                                value={editingCategoryName}
                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                className="h-8 flex-1"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleSaveCategory()
                                }}
                              />
                            ) : (
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{category.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {category.usesLabourTeams
                                    ? "Uses labour teams"
                                    : `${category.subcategories.length} subcategories`}
                                </p>
                              </div>
                            )}
                            <div
                              className="flex shrink-0 gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {editingCategoryId === category.id ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={saving}
                                  onClick={() => void handleSaveCategory()}
                                >
                                  Save
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setEditingCategoryId(category.id)
                                      setEditingCategoryName(category.name)
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Delete {category.name}?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          It will no longer appear on new expenses. Past
                                          expenses keep this category name.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => void handleDeleteCategory(category.id)}
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="space-y-3 rounded-lg border p-3">
                      <Label>Add category</Label>
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g. Materials"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleAddCategory()
                        }}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Uses labour teams</p>
                          <p className="text-xs text-muted-foreground">
                            New expenses pick a team instead of a subcategory.
                          </p>
                        </div>
                        <Switch
                          checked={newCategoryLabour}
                          onCheckedChange={setNewCategoryLabour}
                        />
                      </div>
                      <Button onClick={() => void handleAddCategory()} disabled={saving}>
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="mr-1 h-4 w-4" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="section-card">
                  <CardHeader>
                    <CardTitle>
                      {selected
                        ? selected.usesLabourTeams
                          ? `${selected.name} — labour teams`
                          : `Subcategories — ${selected.name}`
                        : "Subcategories"}
                    </CardTitle>
                    <CardDescription>
                      {selected?.usesLabourTeams
                        ? "Labour teams stay on each project (Manpower / expense form). They are not part of this company catalog."
                        : "Only this list is offered on new expenses for the selected category."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selected ? (
                      <p className="text-sm text-muted-foreground">Select a category.</p>
                    ) : selected.usesLabourTeams ? (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Uses labour teams</p>
                          <p className="text-xs text-muted-foreground">
                            Turn this off to manage subcategories here instead.
                          </p>
                        </div>
                        <Switch
                          checked
                          disabled={saving}
                          onCheckedChange={(value) => void handleToggleLabour(selected, value)}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">Uses labour teams</p>
                            <p className="text-xs text-muted-foreground">
                              Off — this category uses subcategories.
                            </p>
                          </div>
                          <Switch
                            checked={false}
                            disabled={saving}
                            onCheckedChange={(value) => void handleToggleLabour(selected, value)}
                          />
                        </div>
                        <div className="max-h-[22rem] space-y-2 overflow-y-auto rounded-lg border p-2">
                          {selected.subcategories.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                              No subcategories yet.
                            </p>
                          ) : (
                            selected.subcategories.map((sub) => (
                              <div
                                key={sub.id}
                                className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-2"
                              >
                                {editingSubId === sub.id ? (
                                  <Input
                                    value={editingSubName}
                                    onChange={(e) => setEditingSubName(e.target.value)}
                                    className="h-8 flex-1"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") void handleSaveSub()
                                    }}
                                  />
                                ) : (
                                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {sub.name}
                                  </p>
                                )}
                                <div className="flex shrink-0 gap-1">
                                  {editingSubId === sub.id ? (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      disabled={saving}
                                      onClick={() => void handleSaveSub()}
                                    >
                                      Save
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                          setEditingSubId(sub.id)
                                          setEditingSubName(sub.name)
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>
                                              Delete {sub.name}?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                              New expenses will no longer offer this
                                              subcategory. Past expenses keep it.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => void handleDeleteSub(sub.id)}
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            placeholder="e.g. Cement"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleAddSub()
                            }}
                          />
                          <Button onClick={() => void handleAddSub()} disabled={saving}>
                            Add
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {FINANCE_TABS.map((tab) => (
              <TabsContent key={tab.kind} value={tab.kind} className="mt-4">
                <Card className="section-card max-w-xl">
                  <CardHeader>
                    <CardTitle>{tab.label}</CardTitle>
                    <CardDescription>
                      Master list for new {tab.label.toLowerCase()}. Existing rows keep
                      the category they were saved with.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border p-2">
                      {(financeByKind[tab.kind] ?? []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-2"
                        >
                          {editingCategoryId === item.id ? (
                            <Input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              className="h-8 flex-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  void handleSaveFinance(
                                    tab.kind,
                                    item.id,
                                    editingCategoryName,
                                  )
                                }
                              }}
                            />
                          ) : (
                            <p className="min-w-0 flex-1 truncate text-sm font-medium">
                              {item.name}
                            </p>
                          )}
                          <div className="flex shrink-0 gap-1">
                            {editingCategoryId === item.id ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={saving || item.id.startsWith("fallback-")}
                                onClick={() =>
                                  void handleSaveFinance(
                                    tab.kind,
                                    item.id,
                                    editingCategoryName,
                                  )
                                }
                              >
                                Save
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={item.id.startsWith("fallback-")}
                                  onClick={() => {
                                    setEditingCategoryId(item.id)
                                    setEditingCategoryName(item.name)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      disabled={item.id.startsWith("fallback-")}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        New entries will not show this category. Past
                                        entries keep it.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          void handleDeleteFinance(tab.kind, item.id)
                                        }
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newFinanceName[tab.kind]}
                        onChange={(e) =>
                          setNewFinanceName((prev) => ({
                            ...prev,
                            [tab.kind]: e.target.value,
                          }))
                        }
                        placeholder="Add category"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleAddFinance(tab.kind)
                        }}
                      />
                      <Button
                        onClick={() => void handleAddFinance(tab.kind)}
                        disabled={saving}
                      >
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PageMain>
    </PageShell>
  )
}
