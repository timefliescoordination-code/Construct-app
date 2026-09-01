'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InspectionStatusBadge } from '@/components/quality/inspection-status-badge'
import type { QualityInspectionListRow } from '@/lib/types/database'
import type { QualityDashboardSummary } from '@/lib/quality/queries'
import { STATS_GRID_CLASS } from '@/components/layout/page'

export function PmQualityCard() {
  const [inspections, setInspections] = useState<QualityInspectionListRow[]>([])
  const [summary, setSummary] = useState<QualityDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/quality/inspections', { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (res.ok) {
          setInspections(body.inspections ?? [])
          setSummary(body.summary ?? null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const pendingReview = inspections.filter((row) => row.status === 'submitted').slice(0, 6)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" />
          Project quality
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inspections">All inspections</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className={STATS_GRID_CLASS}>
              <Stat label="Completed" value={summary?.completed ?? 0} />
              <Stat label="Pending" value={summary?.pending ?? 0} />
              <Stat label="Failed" value={summary?.failed ?? 0} />
              <Stat label="Open actions" value={summary?.openCorrectiveActions ?? 0} />
              <Stat label="Reinspection" value={summary?.reinspectionPending ?? 0} />
              <Stat label="Approvals" value={summary?.approvalsPending ?? 0} />
            </div>
            {pendingReview.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inspections waiting for PM approval.</p>
            ) : (
              <div className="space-y-2">
                {pendingReview.map((row) => (
                  <Link
                    key={row.id}
                    href={`/inspections/${row.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-muted/40"
                  >
                    <span className="truncate">
                      {row.project?.name} · #{row.inspection_number} {row.work_label}
                    </span>
                    <InspectionStatusBadge status={row.status} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
