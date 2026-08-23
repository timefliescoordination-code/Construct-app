"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatINR } from "@/lib/currency"
import type {
  MoneyTimelineEntry,
  MoneyTimelineFilters,
  MoneyTimelineResponse,
} from "@/lib/money-timeline/types"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Clock, Loader2 } from "lucide-react"

const PAGE_SIZE = 100
const ALL = "all"

function buildQuery(filters: MoneyTimelineFilters, offset: number) {
  const params = new URLSearchParams()
  params.set("offset", String(offset))
  params.set("limit", String(PAGE_SIZE))
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.set("dateTo", filters.dateTo)
  if (filters.projectId) params.set("projectId", filters.projectId)
  if (filters.type && filters.type !== "all") params.set("type", filters.type)
  return params.toString()
}

async function fetchTimeline(query: string): Promise<MoneyTimelineResponse> {
  const response = await fetch(`/api/management/money-timeline?${query}`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? "Failed to load money timeline")
  }
  return response.json()
}

function formatRowDate(row: MoneyTimelineEntry) {
  if (row.dateLabel) return row.dateLabel
  try {
    return format(new Date(row.date), "dd-MMM-yyyy")
  } catch {
    return row.date
  }
}

function TypeBadge({ type }: { type: MoneyTimelineEntry["type"] }) {
  if (type === "received") {
    return (
      <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/15">
        RECEIVED
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      EXPENSE
    </Badge>
  )
}

function TimelineRow({
  row,
  expanded,
  onToggle,
}: {
  row: MoneyTimelineEntry
  expanded: boolean
  onToggle: () => void
}) {
  const isReceived = row.type === "received"
  const itemCount = row.items?.length ?? 0
  const isGroupedExpense = row.type === "expense" && itemCount > 1
  const isMultiDayRange = Boolean(row.endDate && row.endDate !== row.date)
  const summaryText = row.summary ?? row.description
  const singleExpenseDescription =
    row.items?.[0]?.description ?? row.description

  return (
    <>
      <TableRow
        className={cn(
          "transition-colors",
          isReceived && "bg-green-500/5 hover:bg-green-500/10",
        )}
      >
        <TableCell className="whitespace-nowrap text-sm">
          {formatRowDate(row)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {isReceived ? (
              <ArrowDownLeft className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <TypeBadge type={row.type} />
          </div>
        </TableCell>
        <TableCell className="text-sm font-medium text-foreground">
          {row.projectName}
        </TableCell>
        <TableCell
          className={cn(
            "text-right font-medium tabular-nums",
            isReceived && "text-green-600",
          )}
        >
          {formatINR(row.amount)}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {isGroupedExpense ? (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="min-w-0">{summaryText}</span>
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    expanded && "rotate-180",
                  )}
                />
                {expanded ? "Hide details" : "See details"}
              </button>
            </div>
          ) : (
            <span className="truncate">
              {row.type === "expense" ? singleExpenseDescription : row.description}
            </span>
          )}
        </TableCell>
      </TableRow>

      {isGroupedExpense &&
        expanded &&
        row.items?.map((item) => (
          <TableRow
            key={item.id}
            className="bg-muted/20 hover:bg-muted/30 border-l-2 border-l-primary/30"
          >
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="py-2 text-right text-sm tabular-nums">
              {formatINR(item.amount)}
            </TableCell>
            <TableCell className="py-2 pl-8 text-sm text-muted-foreground">
              {isMultiDayRange && item.date ? (
                <span>
                  <span className="text-xs text-muted-foreground/80">
                    {format(new Date(item.date), "dd-MMM")} ·{" "}
                  </span>
                  {item.description}
                </span>
              ) : (
                item.description
              )}
            </TableCell>
          </TableRow>
        ))}
    </>
  )
}

export function MoneyTimelineSection() {
  const [filters, setFilters] = useState<MoneyTimelineFilters>({ type: "all" })
  const [draftFilters, setDraftFilters] = useState<MoneyTimelineFilters>({
    type: "all",
  })
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState<MoneyTimelineEntry[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const query = useMemo(() => buildQuery(filters, offset), [filters, offset])

  const { data, error, isLoading, isValidating } = useSWR(
    `money-timeline-${query}`,
    () => fetchTimeline(query),
    { revalidateOnFocus: false },
  )

  useEffect(() => {
    if (!data) return
    if (offset === 0) {
      setRows(data.rows)
    } else {
      setRows((prev) => {
        const ids = new Set(prev.map((row) => row.id))
        const next = data.rows.filter((row) => !ids.has(row.id))
        return [...prev, ...next]
      })
    }
    setLoadingMore(false)
  }, [data, offset])

  const applyFilters = () => {
    setOffset(0)
    setRows([])
    setExpandedIds(new Set())
    setFilters({ ...draftFilters })
  }

  const resetFilters = () => {
    const cleared: MoneyTimelineFilters = { type: "all" }
    setDraftFilters(cleared)
    setFilters(cleared)
    setOffset(0)
    setRows([])
    setExpandedIds(new Set())
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const loadMore = useCallback(() => {
    if (!data?.hasMore || loadingMore) return
    setLoadingMore(true)
    setOffset((prev) => prev + PAGE_SIZE)
  }, [data?.hasMore, loadingMore])

  return (
    <section>
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5 text-primary" />
            Money Timeline
          </CardTitle>
          <CardDescription>
            When did money come in and where did money go?
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                  {data?.filterOptions.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Transaction type</Label>
              <Select
                value={draftFilters.type ?? ALL}
                onValueChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    type:
                      value === ALL
                        ? "all"
                        : (value as MoneyTimelineFilters["type"]),
                  }))
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All types</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={applyFilters}>
              Apply filters
            </Button>
            <Button size="sm" variant="outline" onClick={resetFilters}>
              Reset
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error.message}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur min-w-[110px]">
                    Date
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur min-w-[100px]">
                    Type
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur min-w-[140px]">
                    Project
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur text-right min-w-[120px]">
                    Amount
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur min-w-[200px]">
                    Description
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && rows.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No transactions match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TimelineRow
                      key={row.id}
                      row={row}
                      expanded={expandedIds.has(row.id)}
                      onToggle={() => toggleExpanded(row.id)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {rows.length} of {data?.total ?? 0} transactions
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
