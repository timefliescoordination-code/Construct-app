'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InspectionStatusBadge } from '@/components/quality/inspection-status-badge'
import type { QualityInspectionListRow } from '@/lib/types/database'
import type { QualityDashboardSummary } from '@/lib/quality/queries'

export function EngineerQualityCard({ projectId }: { projectId?: string | null }) {
  const [inspections, setInspections] = useState<QualityInspectionListRow[]>([])
  const [summary, setSummary] = useState<QualityDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({ mine: '1' })
    if (projectId) params.set('projectId', projectId)
    void fetch(`/api/quality/inspections?${params.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (res.ok) {
          setInspections(body.inspections ?? [])
          setSummary(body.summary ?? null)
        }
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const focus = inspections
    .filter((row) =>
      ['draft', 'in_progress', 'failed', 'awaiting_correction', 'ready_for_reinspection'].includes(
        row.status,
      ),
    )
    .slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" />
          My inspections
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={projectId ? `/projects/${projectId}?tab=quality` : '/inspections'}>
            Open
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <Stat label="Pending" value={summary?.pending ?? 0} />
              <Stat label="In progress" value={summary?.pending ?? 0} />
              <Stat label="Failed" value={summary?.failed ?? 0} />
              <Stat label="Reinspect" value={summary?.reinspectionPending ?? 0} />
              <Stat label="Done" value={summary?.completed ?? 0} />
            </div>
            {focus.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open inspections. Start one from the current stage.
              </p>
            ) : (
              <div className="space-y-2">
                {focus.map((row) => (
                  <Link
                    key={row.id}
                    href={`/inspections/${row.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-muted/40"
                  >
                    <span className="truncate">
                      #{row.inspection_number} {row.work_label}
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
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  )
}
