"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { useAuth } from "@/lib/hooks/use-auth"
import { formatINR } from "@/lib/currency"
import {
  formatRateChangePercent,
  MATERIAL_CATEGORY_GROUPS,
} from "@/lib/materials/constants"
import type { MaterialIntelligenceRow } from "@/lib/data/materials"
import type { MaterialPurchaseWithProject } from "@/lib/types/database"

type PaginatedMaterialsResponse = {
  materials: MaterialIntelligenceRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type PurchaseDetailsState = {
  loading: boolean
  data?: MaterialPurchaseWithProject[]
  error?: string
}

const TABLE_COLUMNS = 7

export function MaterialIntelligencePage() {
  const router = useRouter()
  const { profile, isLoading: authLoading } = useAuth()
  const [page, setPage] = useState(1)
  const [materialsPage, setMaterialsPage] = useState<PaginatedMaterialsResponse | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedMaterialIds, setExpandedMaterialIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [purchaseDetailsByMaterialId, setPurchaseDetailsByMaterialId] = useState<
    Record<string, PurchaseDetailsState>
  >({})

  useEffect(() => {
    if (!authLoading && profile?.role !== "admin") {
      router.replace("/admin")
    }
  }, [authLoading, profile?.role, router])

  const loadMaterials = useCallback(async (nextPage: number) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/material-intelligence?page=${nextPage}`,
        { credentials: "include", cache: "no-store" },
      )
      const json = (await response.json().catch(() => ({}))) as {
        data?: PaginatedMaterialsResponse
        error?: string
      }

      if (!response.ok) {
        setError(json.error ?? "Failed to load materials.")
        setMaterialsPage(null)
        return
      }

      setMaterialsPage(json.data ?? null)
      setExpandedMaterialIds(new Set())
    } catch {
      setError("Failed to load materials.")
      setMaterialsPage(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || profile?.role !== "admin") return
    void loadMaterials(page)
  }, [authLoading, profile?.role, page, loadMaterials])

  const materialsByCategory = useMemo(() => {
    const grouped = new Map<string, MaterialIntelligenceRow[]>()
    for (const category of MATERIAL_CATEGORY_GROUPS) {
      grouped.set(category, [])
    }

    for (const material of materialsPage?.materials ?? []) {
      const list = grouped.get(material.category) ?? []
      list.push(material)
      grouped.set(material.category, list)
    }

    return grouped
  }, [materialsPage?.materials])

  const loadPurchaseDetails = async (materialId: string) => {
    setPurchaseDetailsByMaterialId((prev) => ({
      ...prev,
      [materialId]: { loading: true },
    }))

    try {
      const response = await fetch(
        `/api/admin/material-intelligence/${materialId}/purchases`,
        { credentials: "include", cache: "no-store" },
      )
      const json = (await response.json().catch(() => ({}))) as {
        data?: MaterialPurchaseWithProject[]
        error?: string
      }

      if (!response.ok) {
        setPurchaseDetailsByMaterialId((prev) => ({
          ...prev,
          [materialId]: {
            loading: false,
            error: json.error ?? "Failed to load purchase history.",
          },
        }))
        return
      }

      setPurchaseDetailsByMaterialId((prev) => ({
        ...prev,
        [materialId]: { loading: false, data: json.data ?? [] },
      }))
    } catch {
      setPurchaseDetailsByMaterialId((prev) => ({
        ...prev,
        [materialId]: {
          loading: false,
          error: "Failed to load purchase history.",
        },
      }))
    }
  }

  const toggleMaterialDetails = async (materialId: string) => {
    if (expandedMaterialIds.has(materialId)) {
      setExpandedMaterialIds((prev) => {
        const next = new Set(prev)
        next.delete(materialId)
        return next
      })
      return
    }

    setExpandedMaterialIds((prev) => new Set(prev).add(materialId))

    const cached = purchaseDetailsByMaterialId[materialId]
    if (!cached?.data && !cached?.loading) {
      await loadPurchaseDetails(materialId)
    }
  }

  if (authLoading || profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-6 md:px-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Material Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track material rates, purchase history, and price changes across projects.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="bg-card border-border">
            <CardContent className="py-10 text-center text-destructive">{error}</CardContent>
          </Card>
        ) : materialsPage?.total === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-10 text-center text-muted-foreground">
              No materials found. Add materials to the catalog to see intelligence here.
            </CardContent>
          </Card>
        ) : (
          <>
            {MATERIAL_CATEGORY_GROUPS.map((category) => {
              const materials = materialsByCategory.get(category) ?? []
              if (materials.length === 0) return null

              return (
                <Card key={category} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{category}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-muted/50">
                            <TableHead>Material</TableHead>
                            <TableHead className="text-right">Average Rate</TableHead>
                            <TableHead className="text-right">Previous Rate</TableHead>
                            <TableHead className="text-right">Latest Rate</TableHead>
                            <TableHead className="text-right">Rate Change %</TableHead>
                            <TableHead className="text-right">Purchase Count</TableHead>
                            <TableHead className="w-28" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {materials.map((material) => {
                            const isExpanded = expandedMaterialIds.has(material.id)
                            const purchaseDetails = purchaseDetailsByMaterialId[material.id]

                            return (
                              <Fragment key={material.id}>
                                <TableRow className="border-border hover:bg-muted/50">
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col gap-1">
                                      <span>{material.materialName}</span>
                                      {material.isRateIncreased ? (
                                        <Badge
                                          variant="outline"
                                          className="w-fit border-amber-500/40 bg-amber-500/10 text-amber-600"
                                        >
                                          ⚠ Increased
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatINR(material.averageRate)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatINR(material.previousRate)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatINR(material.latestRate)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatRateChangePercent(material.rateChangePercent)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {material.purchaseCount}
                                  </TableCell>
                                  <TableCell>
                                    <button
                                      type="button"
                                      className="text-xs text-primary underline-offset-2 hover:underline"
                                      onClick={() => void toggleMaterialDetails(material.id)}
                                    >
                                      {isExpanded ? "▲ Hide" : "▼ Details"}
                                    </button>
                                  </TableCell>
                                </TableRow>

                                {isExpanded ? (
                                  <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
                                    <TableCell colSpan={TABLE_COLUMNS} className="py-3">
                                      {purchaseDetails?.loading ? (
                                        <p className="text-sm text-muted-foreground">
                                          Loading purchase history…
                                        </p>
                                      ) : purchaseDetails?.error ? (
                                        <p className="text-sm text-destructive">
                                          {purchaseDetails.error}
                                        </p>
                                      ) : purchaseDetails?.data?.length ? (
                                        <div className="overflow-x-auto">
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="border-border hover:bg-transparent">
                                                <TableHead>Vendor Name</TableHead>
                                                <TableHead>Project</TableHead>
                                                <TableHead>Purchase Date</TableHead>
                                                <TableHead className="text-right">Rate</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {purchaseDetails.data.map((purchase) => (
                                                <TableRow
                                                  key={purchase.id}
                                                  className="border-border hover:bg-muted/30"
                                                >
                                                  <TableCell>
                                                    {purchase.vendor_name || "—"}
                                                  </TableCell>
                                                  <TableCell>
                                                    {purchase.project_name || "—"}
                                                  </TableCell>
                                                  <TableCell>
                                                    {format(
                                                      new Date(purchase.purchase_date),
                                                      "MMM dd, yyyy",
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    {formatINR(purchase.rate)}
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">
                                          No purchase history recorded yet.
                                        </p>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {materialsPage && materialsPage.totalPages > 1 ? (
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        if (page > 1) setPage((current) => current - 1)
                      }}
                      className={
                        page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 text-sm text-muted-foreground">
                      Page {materialsPage.page} of {materialsPage.totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        if (page < materialsPage.totalPages) {
                          setPage((current) => current + 1)
                        }
                      }}
                      className={
                        page >= materialsPage.totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}

            {materialsPage ? (
              <p className="text-xs text-muted-foreground text-right">
                Showing {materialsPage.materials.length} of {materialsPage.total} materials
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}
