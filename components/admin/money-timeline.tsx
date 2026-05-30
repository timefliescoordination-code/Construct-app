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
import { ArrowDownLeft, ArrowUpRight, Clock, Loader2 } from "lucide-react"

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
  const response = await fetch(`/api/admin/money-timeline?${query}`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? "Failed to load money timeline")
  }
  return response.json()
}

function formatTimelineDate(date: string) {
  try {
    return format(new Date(date), "dd-MMM-yyyy")
  } catch {
    return date
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

export function MoneyTimelineSection() {
  const [filters, setFilters] = useState<MoneyTimelineFilters>({ type: "all" })
  const [draftFilters, setDraftFilters] = useState<MoneyTimelineFilters>({
    type: "all",
  })
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState<MoneyTimelineEntry[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

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
    setFilters({ ...draftFilters })
  }

  const resetFilters = () => {
    const cleared: MoneyTimelineFilters = { type: "all" }
    setDraftFilters(cleared)
    setFilters(cleared)
    setOffset(0)
    setRows([])
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur min-w-[200px]">
                    Description
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur min-w-[140px]">
                    Project
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-muted/95 backdrop-blur text-right min-w-[120px]">
                    Amount
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
                    <TableRow
                      key={row.id}
                      className={cn(
                        "transition-colors",
                        row.type === "received" &&
                          "bg-green-500/5 hover:bg-green-500/10",
                      )}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatTimelineDate(row.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {row.type === "received" ? (
                            <ArrowDownLeft className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <TypeBadge type={row.type} />
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.projectName}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          row.type === "received" && "text-green-600",
                        )}
                      >
                        {formatINR(row.amount)}
                      </TableCell>
                    </TableRow>
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
