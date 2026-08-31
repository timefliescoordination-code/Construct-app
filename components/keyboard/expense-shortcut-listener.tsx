"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { useExpenseShortcutRegistry } from "@/lib/keyboard/expense-shortcut-context"
import { ExpenseTypePickerDialog } from "@/components/keyboard/expense-type-picker-dialog"
import { CompanyFinancePickerDialog } from "@/components/keyboard/company-finance-picker-dialog"
import { ProjectPickerDialog } from "@/components/finance/project-picker-dialog"
import { ProjectExpensePickerDialog } from "@/components/keyboard/project-expense-picker-dialog"
import { canEnterManpowerData, canViewProjectFinancials } from "@/lib/permissions"

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return false
}

const PROJECT_ID_PATTERN =
  /^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function ExpenseShortcutListener() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { role, isLoading } = useAuth()
  const registry = useExpenseShortcutRegistry()

  const [fullPickerOpen, setFullPickerOpen] = useState(false)
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectPickerMode, setProjectPickerMode] = useState<
    "expense" | "manpower" | "receipt"
  >("expense")
  const [projectKindPickerOpen, setProjectKindPickerOpen] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)

  const setProjects = registry.setProjects

  useEffect(() => {
    if (isLoading) return
    if (!role || role === "customer") return
    if (pathname.startsWith("/proposal/")) return
    if (pathname === "/login" || pathname === "/signup" || pathname === "/setup") return

    let cancelled = false
    void fetch("/api/projects?summary=true", { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        const rows = (json.data ?? []) as { id: string; name: string }[]
        setProjects(rows.map((p) => ({ id: p.id, name: p.name })))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [isLoading, role, pathname, setProjects])

  const openProjectExpense = useCallback(
    (projectId: string) => {
      if (registry.triggerProjectAdd(projectId)) return
      router.push(`/projects/${projectId}?tab=expenses&add=1`)
    },
    [registry, router],
  )

  const openProjectReceipt = useCallback(
    (projectId: string) => {
      if (registry.triggerClientPaymentAdd(projectId)) return
      router.push(`/projects/${projectId}?tab=payments&addReceipt=1`)
    },
    [registry, router],
  )

  const openProjectKindPicker = useCallback((projectId?: string) => {
    setPendingProjectId(projectId ?? null)
    setProjectKindPickerOpen(true)
  }, [])

  const chooseProjectForExpense = useCallback(() => {
    setProjectPickerMode("expense")
    setProjectPickerOpen(true)
  }, [])

  const chooseProjectForReceipt = useCallback(() => {
    setProjectPickerMode("receipt")
    setProjectPickerOpen(true)
  }, [])

  const openCompanyExpense = useCallback(() => {
    if (pathname === "/admin/expenses" && registry.triggerCompanyExpense()) return
    router.push("/admin/expenses?tab=company&add=1")
  }, [pathname, registry, router])

  const openCompanyIncome = useCallback(() => {
    if (pathname === "/admin/expenses" && registry.triggerCompanyIncome()) return
    router.push("/admin/expenses?tab=company&addIncome=1")
  }, [pathname, registry, router])

  const openPersonalExpense = useCallback(() => {
    if (pathname === "/admin/expenses" && registry.triggerPersonalExpense()) return
    router.push("/admin/expenses?tab=personal&add=1")
  }, [pathname, registry, router])

  const openProjectManpower = useCallback(
    (projectId: string) => {
      if (registry.triggerManpowerAdd(projectId)) return
      router.push(`/projects/${projectId}?tab=manpower&addWeek=1`)
    },
    [registry, router],
  )

  const openManpowerPicker = useCallback(() => {
    if (registry.projects.length === 1) {
      openProjectManpower(registry.projects[0].id)
      return
    }
    setProjectPickerMode("manpower")
    setProjectPickerOpen(true)
  }, [openProjectManpower, registry.projects])

  const handleCtrlL = useCallback(() => {
    if (isLoading || !canEnterManpowerData(role)) return

    const projectMatch = pathname.match(PROJECT_ID_PATTERN)
    if (projectMatch) {
      openProjectManpower(projectMatch[1])
      return
    }

    if (pathname === "/login" || pathname === "/signup" || pathname === "/customer") {
      return
    }

    openManpowerPicker()
  }, [isLoading, role, pathname, openProjectManpower, openManpowerPicker])

  const handleCtrlE = useCallback(() => {
    if (isLoading || !role || role === "customer") return

    const projectMatch = pathname.match(PROJECT_ID_PATTERN)
    if (projectMatch) {
      if (canViewProjectFinancials(role)) {
        openProjectKindPicker(projectMatch[1])
      } else {
        openProjectExpense(projectMatch[1])
      }
      return
    }

    if (pathname === "/engineer") {
      registry.triggerEngineerExpense()
      return
    }

    if (pathname === "/login" || pathname === "/signup" || pathname === "/customer") {
      return
    }

    if (pathname === "/admin/expenses") {
      const tab = searchParams.get("tab") ?? "company"
      if (tab === "personal") {
        openPersonalExpense()
        return
      }
      setCompanyPickerOpen(true)
      return
    }

    setFullPickerOpen(true)
  }, [
    isLoading,
    role,
    pathname,
    searchParams,
    openProjectExpense,
    openPersonalExpense,
    registry,
    openProjectKindPicker,
  ])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (pathname.startsWith("/proposal/")) return
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      if (isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === "e") {
        e.preventDefault()
        handleCtrlE()
        return
      }
      if (key === "l") {
        if (!canEnterManpowerData(role)) return
        e.preventDefault()
        handleCtrlL()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleCtrlE, handleCtrlL, role, pathname])

  return (
    <>
      <ExpenseTypePickerDialog
        open={fullPickerOpen}
        onOpenChange={setFullPickerOpen}
        onPickProject={() => {
          setFullPickerOpen(false)
          window.setTimeout(() => {
            if (canViewProjectFinancials(role)) {
              openProjectKindPicker()
            } else {
              chooseProjectForExpense()
            }
          }, 0)
        }}
        onPickCompanyExpense={() => {
          setFullPickerOpen(false)
          openCompanyExpense()
        }}
        onPickCompanyIncome={() => {
          setFullPickerOpen(false)
          openCompanyIncome()
        }}
        onPickPersonalExpense={() => {
          setFullPickerOpen(false)
          openPersonalExpense()
        }}
      />
      <CompanyFinancePickerDialog
        open={companyPickerOpen}
        onOpenChange={setCompanyPickerOpen}
        onPickExpense={() => {
          setCompanyPickerOpen(false)
          openCompanyExpense()
        }}
        onPickIncome={() => {
          setCompanyPickerOpen(false)
          openCompanyIncome()
        }}
      />
      <ProjectExpensePickerDialog
        open={projectKindPickerOpen}
        onOpenChange={setProjectKindPickerOpen}
        showReceipts={canViewProjectFinancials(role)}
        onPickExpense={() => {
          setProjectKindPickerOpen(false)
          window.setTimeout(() => {
            if (pendingProjectId) {
              openProjectExpense(pendingProjectId)
              return
            }
            chooseProjectForExpense()
          }, 0)
        }}
        onPickReceipt={() => {
          setProjectKindPickerOpen(false)
          window.setTimeout(() => {
            if (pendingProjectId) {
              openProjectReceipt(pendingProjectId)
              return
            }
            chooseProjectForReceipt()
          }, 0)
        }}
      />
      <ProjectPickerDialog
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
        projects={registry.projects}
        title={
          projectPickerMode === "manpower"
            ? "Select project for manpower"
            : projectPickerMode === "receipt"
              ? "Select project for receipts"
              : "Select project"
        }
        hrefForProject={
          projectPickerMode === "manpower"
            ? (id) => `/projects/${id}?tab=manpower&addWeek=1`
            : projectPickerMode === "receipt"
              ? (id) => `/projects/${id}?tab=payments&addReceipt=1`
              : undefined
        }
      />
    </>
  )
}
