"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatINR } from "@/lib/currency"
import type {
  CashFlowLedgerFilters,
  CashFlowLedgerResponse,
  CashFlowLedgerRow,
} from "@/lib/cash-flow-ledger/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronDown,
  Landmark,
  Loader2,
  TrendingUp,
  Wallet,
  PiggyBank,
} from "lucide-react"

const PAGE_SIZE = 100
const ALL = "all"

function buildQuery(filters: CashFlowLedgerFilters, offset: number) {
  const params = new URLSearchParams()
  params.set("offset", String(offset))
  params.set("limit", String(PAGE_SIZE))
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.set("dateTo", filters.dateTo)
  if (filters.client) params.set("client", filters.client)
  if (filters.projectId) params.set("projectId", filters.projectId)
  if (filters.minAmount != null) params.set("minAmount", String(filters.minAmount))
  if (filters.maxAmount != null) params.set("maxAmount", String(filters.maxAmount))
  if (filters.allocationStatus && filters.allocationStatus !== "all") {
    params.set("allocationStatus", filters.allocationStatus)
  }
  return params.toString()
}

async function fetchLedger(query: string): Promise<CashFlowLedgerResponse> {
  const response = await fetch(`/api/admin/cash-flow-ledger?${query}`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? "Failed to load cash flow ledger")
  }
  return response.json()
}

function statusBadge(status: CashFlowLedgerRow["status"]) {
  switch (status) {
    case "fully_allocated":
      return (
        <Badge className="bg-green-500/15 text-green-500 border-green-500/30">
          Fully Allocated
        </Badge>
      )
    case "partially_allocated":
      return (
        <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">
          Partially Allocated
        </Badge>
      )
    default:
      return (
        <Badge className="bg-red-500/15 text-red-500 border-red-500/30">
          Unallocated
        </Badge>
      )
  }
}

function progressBarColor(status: CashFlowLedgerRow["status"]) {
  switch (status) {
    case "fully_allocated":
      return "bg-green-500"
    case "partially_allocated":
      return "bg-amber-500"
    default:
      return "bg-red-500/70"
  }
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string
  value: string
  icon: typeof Wallet
  accent: string
}) {
  return (
    <Card className="bg-card/80 border-border">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">{value}</p>
          </div>
          <div className={cn("rounded-lg p-2.5", accent)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LedgerRow({ row }: { row: CashFlowLedgerRow }) {
  const [open, setOpen] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const formattedDate = useMemo(() => {
    try {
      return format(new Date(row.receivedDate), "dd-MMM-yyyy")
    } catch {
      return row.receivedDate
    }
  }, [row.receivedDate])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-border/70 last:border-b-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 sm:px-5"
          >
            <div className="flex items-start gap-3">
              <ChevronDown
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{row.clientName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {row.projectName}
                      {row.stageName ? ` · ${row.stageName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {statusBadge(row.status)}
                    <span className="text-sm font-semibold">
                      {formatINR(row.amountReceived)}
                    </span>
                    <span className="text-xs text-muted-foreground">{formattedDate}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
                  <span>
                    <span className="text-muted-foreground">Allocated </span>
                    <span className="font-medium text-green-500">
                      {formatINR(row.allocated)}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Balance </span>
                    <span
                      className={cn(
                        "font-medium",
                        row.balance > 0 ? "text-amber-500" : "text-muted-foreground",
                      )}
                    >
                      {formatINR(row.balance)}
                    </span>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Received {formatINR(row.amountReceived)}</span>
                    <span>{row.allocationPercent}% allocated</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        progressBarColor(row.status),
                      )}
                      style={{ width: `${row.allocationPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Allocated {formatINR(row.allocated)}
                  </p>
                </div>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden transition-all duration-200">
          <div className="space-y-3 border-t border-border/60 bg-muted/10 px-4 py-4 sm:px-5 sm:pl-12">
            {row.projectGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approved expenses allocated to this receipt yet.
              </p>
            ) : (
              row.projectGroups.map((group) => {
                const projectOpen = expandedProjects.has(group.projectId)
                const showProjectShell = row.projectGroups.length > 1

                if (!showProjectShell) {
                  return (
                    <div key={group.projectId} className="space-y-2">
                      {group.categories.map((cat) => (
                        <div
                          key={`${group.projectId}-${cat.category}`}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            {cat.category} - {group.projectName}
                          </span>
                          <span className="shrink-0 font-medium tabular-nums">
                            {formatINR(cat.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }

                return (
                  <Collapsible
                    key={group.projectId}
                    open={projectOpen}
                    onOpenChange={() => toggleProject(group.projectId)}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-card/50 px-3 py-2 text-left text-sm hover:bg-muted/40"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                              projectOpen && "rotate-180",
                            )}
                          />
                          <span className="truncate">{group.projectName} Expenses</span>
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatINR(group.totalAllocated)}
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden transition-all duration-200">
                      <div className="mt-2 space-y-1.5 border-l-2 border-border/60 pl-4">
                        {group.categories.map((cat) => (
                          <div
                            key={`${group.projectId}-${cat.category}`}
                            className="flex items-center justify-between gap-4 text-sm"
                          >
                            <span className="truncate text-muted-foreground">
                              {cat.category}
                            </span>
                            <span className="shrink-0 font-medium tabular-nums">
                              {formatINR(cat.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })
            )}

            <div className="flex flex-wrap justify-between gap-2 border-t border-border/50 pt-3 text-sm">
              <span>
                Total Allocated:{" "}
                <span className="font-semibold text-green-500">
                  {formatINR(row.allocated)}
                </span>
              </span>
              <span>
                Unallocated Balance:{" "}
                <span className="font-semibold text-amber-500">
                  {formatINR(row.balance)}
                </span>
              </span>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function CashFlowLedgerSection() {
  const [filters, setFilters] = useState<CashFlowLedgerFilters>({
    allocationStatus: "all",
  })
  const [draftFilters, setDraftFilters] = useState<CashFlowLedgerFilters>({
    allocationStatus: "all",
  })
  const [offset, setOffset] = useState(0)
  const [accumulatedRows, setAccumulatedRows] = useState<CashFlowLedgerRow[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  const query = useMemo(() => buildQuery(filters, offset), [filters, offset])

  const { data, error, isLoading, isValidating } = useSWR(
    `cash-flow-ledger-${query}`,
    () => fetchLedger(query),
    { revalidateOnFocus: false },
  )

  useEffect(() => {
    if (!data) return
    if (offset === 0) {
      setAccumulatedRows(data.rows)
    } else {
      setAccumulatedRows((prev) => {
        const ids = new Set(prev.map((row) => row.paymentId))
        const next = data.rows.filter((row) => !ids.has(row.paymentId))
        return [...prev, ...next]
      })
    }
    setLoadingMore(false)
  }, [data, offset])

  const applyFilters = () => {
    setOffset(0)
    setAccumulatedRows([])
    setFilters({ ...draftFilters })
  }

  const resetFilters = () => {
    const cleared: CashFlowLedgerFilters = { allocationStatus: "all" }
    setDraftFilters(cleared)
    setFilters(cleared)
    setOffset(0)
    setAccumulatedRows([])
  }

  const loadMore = useCallback(() => {
    if (!data?.hasMore || loadingMore) return
    setLoadingMore(true)
    setOffset((prev) => prev + PAGE_SIZE)
  }, [data?.hasMore, loadingMore])

  const filterOptions = data?.filterOptions

  return (
    <section>
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Landmark className="h-5 w-5 text-primary" />
                Cash Flow Ledger
              </CardTitle>
              <CardDescription className="mt-1">
                Track how client receipts were utilized across projects and expenses.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading && !data ? (
              <>
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </>
            ) : (
              <>
                <SummaryCard
                  title="Total Received"
                  value={formatINR(data?.summary.totalReceived ?? 0)}
                  icon={Wallet}
                  accent="bg-primary/10 text-primary"
                />
                <SummaryCard
                  title="Total Allocated"
                  value={formatINR(data?.summary.totalAllocated ?? 0)}
                  icon={TrendingUp}
                  accent="bg-green-500/10 text-green-500"
                />
                <SummaryCard
                  title="Unallocated Balance"
                  value={formatINR(data?.summary.unallocatedBalance ?? 0)}
                  icon={PiggyBank}
                  accent="bg-amber-500/10 text-amber-500"
                />
                <SummaryCard
                  title="Allocation Efficiency"
                  value={`${data?.summary.allocationEfficiency ?? 0}%`}
                  icon={Landmark}
                  accent="bg-violet-500/10 text-violet-400"
                />
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/10 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Date from</Label>
                <Input
                  type="date"
                  value={draftFilters.dateFrom ?? ""}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      dateFrom: e.target.value || undefined,
                    }))
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date to</Label>
                <Input
                  type="date"
                  value={draftFilters.dateTo ?? ""}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      dateTo: e.target.value || undefined,
                    }))
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <Select
                  value={draftFilters.client ?? ALL}
                  onValueChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      client: value === ALL ? undefined : value,
                    }))
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All clients</SelectItem>
                    {filterOptions?.clients.map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project</Label>
                <Select
                  value={draftFilters.projectId ?? ALL}
                  onValueChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      projectId: value === ALL ? undefined : value,
                    }))
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All projects</SelectItem>
                    {filterOptions?.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Min amount</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={draftFilters.minAmount ?? ""}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      minAmount: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max amount</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={draftFilters.maxAmount ?? ""}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      maxAmount: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Allocation status</Label>
                <Select
                  value={draftFilters.allocationStatus ?? ALL}
                  onValueChange={(value) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      allocationStatus:
                        value === ALL
                          ? "all"
                          : (value as CashFlowLedgerFilters["allocationStatus"]),
                    }))
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    <SelectItem value="fully_allocated">Fully Allocated</SelectItem>
                    <SelectItem value="partially_allocated">
                      Partially Allocated
                    </SelectItem>
                    <SelectItem value="unallocated">Unallocated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={applyFilters}>
                Apply filters
              </Button>
              <Button size="sm" variant="outline" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error.message}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="sticky top-0 z-10 hidden border-b border-border bg-muted/80 backdrop-blur sm:grid sm:grid-cols-[1.4fr_1fr_auto] sm:gap-4 sm:px-5 sm:py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Client / Project
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Allocation
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">
                Received
              </span>
            </div>

            {isLoading && accumulatedRows.length === 0 ? (
              <div className="space-y-0">
                <Skeleton className="h-28 w-full rounded-none" />
                <Skeleton className="h-28 w-full rounded-none" />
                <Skeleton className="h-28 w-full rounded-none" />
              </div>
            ) : accumulatedRows.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                No received client payments match your filters.
              </div>
            ) : (
              <div>
                {accumulatedRows.map((row) => (
                  <LedgerRow key={row.paymentId} row={row} />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {accumulatedRows.length} of {data?.total ?? 0} receipts
              {(isValidating || loadingMore) && " · Updating…"}
            </p>
            {data?.hasMore && (
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore || isValidating}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
