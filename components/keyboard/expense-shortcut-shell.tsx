"use client"

import { Suspense } from "react"
import { ExpenseShortcutRegistryProvider } from "@/lib/keyboard/expense-shortcut-context"
import { ExpenseShortcutListener } from "@/components/keyboard/expense-shortcut-listener"

export function ExpenseShortcutShell({ children }: { children: React.ReactNode }) {
  return (
    <ExpenseShortcutRegistryProvider>
      {children}
      <Suspense fallback={null}>
        <ExpenseShortcutListener />
      </Suspense>
    </ExpenseShortcutRegistryProvider>
  )
}
