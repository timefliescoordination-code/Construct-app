"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type ProjectOption = { id: string; name: string }

type ExpenseShortcutHandlers = {
  projectAdd: Map<string, () => void>
  openCompanyExpense: (() => void) | null
  openCompanyIncome: (() => void) | null
  openPersonalExpense: (() => void) | null
  openEngineerExpense: (() => void) | null
}

type ExpenseShortcutContextValue = {
  registerProjectAdd: (projectId: string, openAdd: () => void) => () => void
  registerCompanyExpense: (open: () => void) => () => void
  registerCompanyIncome: (open: () => void) => () => void
  registerPersonalExpense: (open: () => void) => () => void
  registerEngineerExpense: (open: () => void) => () => void
  triggerProjectAdd: (projectId: string) => boolean
  triggerCompanyExpense: () => boolean
  triggerCompanyIncome: () => boolean
  triggerPersonalExpense: () => boolean
  triggerEngineerExpense: () => boolean
  projects: ProjectOption[]
  setProjects: (projects: ProjectOption[]) => void
}

const ExpenseShortcutContext = createContext<ExpenseShortcutContextValue | null>(
  null,
)

export function ExpenseShortcutRegistryProvider({
  children,
}: {
  children: ReactNode
}) {
  const handlersRef = useRef<ExpenseShortcutHandlers>({
    projectAdd: new Map(),
    openCompanyExpense: null,
    openCompanyIncome: null,
    openPersonalExpense: null,
    openEngineerExpense: null,
  })
  const [projects, setProjectsState] = useState<ProjectOption[]>([])

  const registerProjectAdd = useCallback(
    (projectId: string, openAdd: () => void) => {
      handlersRef.current.projectAdd.set(projectId, openAdd)
      return () => {
        handlersRef.current.projectAdd.delete(projectId)
      }
    },
    [],
  )

  const registerCompanyExpense = useCallback((open: () => void) => {
    handlersRef.current.openCompanyExpense = open
    return () => {
      if (handlersRef.current.openCompanyExpense === open) {
        handlersRef.current.openCompanyExpense = null
      }
    }
  }, [])

  const registerCompanyIncome = useCallback((open: () => void) => {
    handlersRef.current.openCompanyIncome = open
    return () => {
      if (handlersRef.current.openCompanyIncome === open) {
        handlersRef.current.openCompanyIncome = null
      }
    }
  }, [])

  const registerPersonalExpense = useCallback((open: () => void) => {
    handlersRef.current.openPersonalExpense = open
    return () => {
      if (handlersRef.current.openPersonalExpense === open) {
        handlersRef.current.openPersonalExpense = null
      }
    }
  }, [])

  const registerEngineerExpense = useCallback((open: () => void) => {
    handlersRef.current.openEngineerExpense = open
    return () => {
      if (handlersRef.current.openEngineerExpense === open) {
        handlersRef.current.openEngineerExpense = null
      }
    }
  }, [])

  const triggerProjectAdd = useCallback((projectId: string) => {
    const fn = handlersRef.current.projectAdd.get(projectId)
    if (fn) {
      fn()
      return true
    }
    return false
  }, [])

  const triggerCompanyExpense = useCallback(() => {
    const fn = handlersRef.current.openCompanyExpense
    if (fn) {
      fn()
      return true
    }
    return false
  }, [])

  const triggerCompanyIncome = useCallback(() => {
    const fn = handlersRef.current.openCompanyIncome
    if (fn) {
      fn()
      return true
    }
    return false
  }, [])

  const triggerPersonalExpense = useCallback(() => {
    const fn = handlersRef.current.openPersonalExpense
    if (fn) {
      fn()
      return true
    }
    return false
  }, [])

  const triggerEngineerExpense = useCallback(() => {
    const fn = handlersRef.current.openEngineerExpense
    if (fn) {
      fn()
      return true
    }
    return false
  }, [])

  const setProjects = useCallback((next: ProjectOption[]) => {
    setProjectsState(next)
  }, [])

  const value = useMemo(
    (): ExpenseShortcutContextValue => ({
      registerProjectAdd,
      registerCompanyExpense,
      registerCompanyIncome,
      registerPersonalExpense,
      registerEngineerExpense,
      triggerProjectAdd,
      triggerCompanyExpense,
      triggerCompanyIncome,
      triggerPersonalExpense,
      triggerEngineerExpense,
      projects,
      setProjects,
    }),
    [
      registerProjectAdd,
      registerCompanyExpense,
      registerCompanyIncome,
      registerPersonalExpense,
      registerEngineerExpense,
      triggerProjectAdd,
      triggerCompanyExpense,
      triggerCompanyIncome,
      triggerPersonalExpense,
      triggerEngineerExpense,
      projects,
      setProjects,
    ],
  )

  return (
    <ExpenseShortcutContext.Provider value={value}>
      {children}
    </ExpenseShortcutContext.Provider>
  )
}

export function useExpenseShortcutRegistry() {
  const ctx = useContext(ExpenseShortcutContext)
  if (!ctx) {
    throw new Error("useExpenseShortcutRegistry requires ExpenseShortcutRegistryProvider")
  }
  return ctx
}

export function useExpenseShortcutRegistryOptional() {
  return useContext(ExpenseShortcutContext)
}
