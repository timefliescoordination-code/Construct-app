import * as React from "react"
import { cn } from "@/lib/utils"
import { AppSidebar } from "@/components/layout/app-sidebar"

/** Standard authenticated page content width and padding */
export const PAGE_MAIN_CLASS =
  "mx-auto w-full max-w-[1600px] px-4 py-5 sm:py-6 md:px-6 lg:px-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]"

/** Vertical rhythm between major page blocks */
export const PAGE_STACK_CLASS = "flex flex-col gap-6 sm:gap-8"

/** Page header toolbar: full-width controls on mobile */
export const PAGE_HEADER_ACTIONS_CLASS =
  "[&_button]:w-full sm:[&_button]:w-auto [&_[data-slot=select-trigger]]:w-full sm:[&_[data-slot=select-trigger]]:w-auto"

/** Two-column main + sidebar (stacks on mobile) */
export const CONTENT_SIDEBAR_GRID_CLASS =
  "grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8"

export const CONTENT_SIDEBAR_MAIN_CLASS = "min-w-0 lg:col-span-2"

/** Responsive project / detail tabs */
export const TABS_LIST_RESPONSIVE_CLASS =
  "h-auto w-full flex-wrap justify-start gap-1 border border-border bg-muted/50 p-1"

/** 4-column KPI / stat grid */
export const STATS_GRID_CLASS =
  "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"

/** 3-column stat grid */
export const STATS_GRID_3_CLASS =
  "grid gap-4 grid-cols-1 md:grid-cols-3"

export function PageShell({
  children,
  className,
  hideAppSidebar = false,
}: {
  children: React.ReactNode
  className?: string
  /** Project detail uses its own sidebar */
  hideAppSidebar?: boolean
}) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="flex min-h-screen">
        {!hideAppSidebar && <AppSidebar className="hidden lg:flex" />}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}

export function PageMain({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode
  className?: string
  /** Form / detail pages with a narrower max width */
  narrow?: boolean
}) {
  return (
    <main
      className={cn(
        PAGE_MAIN_CLASS,
        narrow && "max-w-4xl",
        PAGE_STACK_CLASS,
        className,
      )}
    >
      {children}
    </main>
  )
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description != null && description !== "" && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children ? (
        <div
          className={cn(
            "flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3",
            PAGE_HEADER_ACTIONS_CLASS,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function PageSection({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
