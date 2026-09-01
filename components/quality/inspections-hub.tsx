'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InspectionStatusBadge } from '@/components/quality/inspection-status-badge'
import { QUALITY_INSPECTION_STATUSES, QUALITY_INSPECTION_STATUS_LABELS } from '@/lib/quality/constants'
import type { QualityInspectionListRow } from '@/lib/types/database'
import type { QualityDashboardSummary } from '@/lib/quality/queries'
import { format } from 'date-fns'
import { useAuth } from '@/lib/hooks/use-auth'
import { STATS_GRID_CLASS } from '@/components/layout/page'

export function InspectionsHub() {
  const { role } = useAuth()
  const [inspections, setInspections] = useState<QualityInspectionListRow[]>([])
  const [summary, setSummary] = useState<QualityDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (role === 'engineer') params.set('mine', '1')
    const res = await fetch(`/api/quality/inspections?${params.toString()}`, {
      credentials: 'include',
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof body.error === 'string' ? body.error : 'Could not load inspections.')
      setInspections([])
      setSummary(null)
    } else {
      setError(null)
      setInspections(body.inspections ?? [])
      setSummary(body.summary ?? null)
    }
    setLoading(false)
  }, [status, role])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = inspections.reduce<Record<string, QualityInspectionListRow[]>>((acc, row) => {
    const key = `${row.milestone?.name ?? 'Stage'}::${row.work_label}`
    acc[key] = acc[key] ?? []
    acc[key].push(row)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className={STATS_GRID_CLASS}>
        <SummaryCard title="Completed" value={summary?.completed ?? 0} />
        <SummaryCard title="Pending" value={summary?.pending ?? 0} />
        <SummaryCard title="Failed" value={summary?.failed ?? 0} />
        <SummaryCard title="Open corrections" value={summary?.openCorrectiveActions ?? 0} />
        <SummaryCard title="Reinspection" value={summary?.reinspectionPending ?? 0} />
        <SummaryCard title="PM approvals" value={summary?.approvalsPending ?? 0} />
      </div>

      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">All statuses</option>
        {QUALITY_INSPECTION_STATUSES.map((value) => (
          <option key={value} value={value}>
            {QUALITY_INSPECTION_STATUS_LABELS[value]}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : inspections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No inspections yet. Open a project stage and start a quality inspection.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, rows]) => {
            const [stageName, workLabel] = key.split('::')
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {workLabel}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{stageName}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Inspection</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link href={`/inspections/${row.id}`} className="font-medium text-primary hover:underline">
                              #{row.inspection_number}
                            </Link>
                          </TableCell>
                          <TableCell>{row.project?.name}</TableCell>
                          <TableCell>{row.location_label || '—'}</TableCell>
                          <TableCell>
                            <InspectionStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(row.created_at), 'dd MMM yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold tabular-nums">{value}</CardContent>
    </Card>
  )
}
