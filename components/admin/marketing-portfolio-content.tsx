"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { MarketingExpenseSheet } from "@/components/admin/marketing-expense-sheet"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageHeader, PageMain, PageShell } from "@/components/layout/page"
import { ScrollTable } from "@/components/layout/scroll-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useAuth } from "@/lib/hooks/use-auth"
import { assignRecognitionRisk } from "@/lib/marketing/recognition-risk"
import { PRIVACY_CHECKLIST, type MarketingPortfolioItem } from "@/lib/marketing/types"
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_LABELS } from "@/lib/project-status"
import type { ProjectStatus } from "@/lib/types/database"
import { cn } from "@/lib/utils"

type StatusFilter = "completed" | "active" | "on-hold" | "pending" | "all"

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "completed", label: "Completed Projects" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On Hold" },
  { value: "pending", label: "Pending" },
  { value: "all", label: "All projects" },
]

export function MarketingPortfolioContent() {
  const router = useRouter()
  const { user, profile, isLoading: authLoading } = useAuth()
  const [items, setItems] = useState<MarketingPortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("completed")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRegenerating(true)
    else setLoading(true)
    try {
      const response = await fetch("/api/management/marketing-portfolio")
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to load marketing drafts")
      }
      setItems(result.items ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load marketing drafts"
      toast.error(message)
    } finally {
      setLoading(false)
      setRegenerating(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== "admin")) {
      router.push("/login")
      return
    }
    if (user && profile?.role === "admin") {
      void load("initial")
    }
  }, [user, profile, authLoading, router, load])

  const filtered = useMemo(() => {
    const rows =
      statusFilter === "all" ? items : items.filter((item) => item.status === statusFilter)
    return assignRecognitionRisk(rows)
  }, [items, statusFilter])

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filtered.some((item) => item.internalId === selectedId)) {
      setSelectedId(filtered[0].internalId)
    }
  }, [filtered, selectedId])

  const selected = filtered.find((item) => item.internalId === selectedId) ?? null

  async function copyMarkdown() {
    if (!selected?.copySafe) {
      toast.error("This draft is not marked safe to copy.")
      return
    }
    setCopying(true)
    try {
      await navigator.clipboard.writeText(selected.markdown)
      toast.success("Sanitized markdown copied")
    } catch {
      toast.error("Could not copy markdown")
    } finally {
      setCopying(false)
    }
  }

  if (authLoading || loading) {
    return (
      <PageShell>
        <DashboardHeader />
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageShell>
    )
  }

  if (profile?.role !== "admin") {
    return null
  }

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Marketing Case Studies"
          description="Convert project data into privacy-preserving construction case studies for marketing content."
        >
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter projects">
              <SelectValue placeholder="Filter projects" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => void load("refresh")}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </PageHeader>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Newspaper className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No projects match this filter.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base">Projects</CardTitle>
                <CardDescription>
                  Real project names are visible here only. They are never copied into the markdown.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollTable minWidth="min-w-[720px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((item) => {
                        const status = item.status as ProjectStatus
                        const badge = PROJECT_STATUS_BADGE[status]
                        const active = item.internalId === selectedId
                        return (
                          <TableRow
                            key={item.internalId}
                            data-state={active ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => setSelectedId(item.internalId)}
                          >
                            <TableCell className="max-w-[220px] truncate font-medium">
                              {item.internalName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={badge?.className}>
                                {badge?.label ?? PROJECT_STATUS_LABELS[status] ?? item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.bands.size ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.bands.cost ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.bands.duration ?? "—"}
                            </TableCell>
                            <TableCell>
                              <RiskBadge risk={item.recognitionRisk} />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ScrollTable>
              </CardContent>
            </Card>

            {selected ? <ProjectDraftPanel
              item={selected}
              copying={copying}
              regenerating={regenerating}
              onCopy={() => void copyMarkdown()}
              onRegenerate={() => void load("refresh")}
            /> : null}
          </div>
        )}
      </PageMain>
    </PageShell>
  )
}

function RiskBadge({ risk }: { risk: "LOW" | "HIGH" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        risk === "HIGH"
          ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {risk === "HIGH" ? "HIGH" : "LOW"}
    </Badge>
  )
}

function ProjectDraftPanel({
  item,
  copying,
  regenerating,
  onCopy,
  onRegenerate,
}: {
  item: MarketingPortfolioItem & { recognitionRisk: "LOW" | "HIGH" }
  copying: boolean
  regenerating: boolean
  onCopy: () => void
  onRegenerate: () => void
}) {
  const chips = [item.bands.size, item.bands.cost, item.bands.duration].filter(Boolean)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public Data Preview</CardTitle>
          <CardDescription>
            Only these banded values appear in the copied article.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {chips.length ? (
            chips.map((chip) => (
              <Badge key={chip} variant="secondary" className="text-sm">
                {chip}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No public size, cost, or duration bands were available for this project.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy checklist</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {PRIVACY_CHECKLIST.map((itemLabel) => (
            <div key={itemLabel} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{itemLabel}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {item.recognitionRisk === "HIGH" ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>HIGH RECOGNITION RISK</AlertTitle>
          <AlertDescription>
            This project&apos;s size + cost + duration combination is unique among the currently
            loaded projects. Consider not publishing this case study.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Recognition Risk: LOW</AlertTitle>
          <AlertDescription>
            At least one other loaded project shares this size + cost + duration combination.
          </AlertDescription>
        </Alert>
      )}

      {!item.copySafe ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Draft is not safe to copy</AlertTitle>
          <AlertDescription>
            <p>The privacy validator rejected this markdown.</p>
            <ul className="mt-2 list-disc pl-4">
              {item.privacyIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <MarketingExpenseSheet
        spendMix={item.spendMix ?? []}
        expenseSheet={item.expenseSheet ?? []}
        subcategories={item.subcategories ?? []}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Markdown preview</CardTitle>
            <CardDescription>
              Copy Markdown copies only the sanitized article — including the expense table, never the
              real project name.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onRegenerate} disabled={regenerating}>
              {regenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerate
            </Button>
            <Button onClick={onCopy} disabled={!item.copySafe || copying}>
              {copying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy Markdown
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
            {item.markdown}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
