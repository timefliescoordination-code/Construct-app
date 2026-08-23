'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { ChangeRequestStatusBadge } from '@/components/change-requests/change-request-status-badge'
import { CHANGE_REQUEST_CATEGORIES, CHANGE_REQUEST_STATUSES } from '@/lib/change-requests/constants'
import type { ChangeRequestStatus } from '@/lib/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR } from '@/lib/currency'

type DashboardRow = {
  id: string
  request_number: string
  title: string
  category: string
  status: ChangeRequestStatus
  created_at: string
  submitted_at: string | null
  estimated_additional_days: number | null
  project_id: string
  project?: { id: string; name: string } | null
  customer?: { id: string; full_name: string } | null
}

export function ChangeRequestsDashboard() {
  const [requests, setRequests] = useState<DashboardRow[]>([])
  const [summary, setSummary] = useState<{
    pendingValue: number
    approvedChangeValue: number
    pendingScheduleDays: number
    approvedScheduleDays: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`/api/change-requests?${params.toString()}`)
      const body = await res.json()
      setRequests(body.requests ?? [])
      setSummary(body.summary ?? null)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter])

  useEffect(() => {
    load()
  }, [load])

  const pendingReview = requests.filter((r) =>
    ['submitted', 'under_review', 'costing_prepared'].includes(r.status),
  ).length
  const pendingInternal = requests.filter((r) => r.status === 'internal_approval_pending').length
  const pendingCustomer = requests.filter((r) => r.status === 'customer_approval_pending').length

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting review</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{pendingReview}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Internal approval</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{pendingInternal}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customer approval</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{pendingCustomer}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending value</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold tabular-nums">
            {formatINR(summary?.pendingValue ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved value</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold tabular-nums">
            {formatINR(summary?.approvedChangeValue ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Schedule impact</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            +{(summary?.pendingScheduleDays ?? 0) + (summary?.approvedScheduleDays ?? 0)}
            <span className="text-sm font-normal text-muted-foreground"> days</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {CHANGE_REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {CHANGE_REQUEST_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/change-requests/${row.id}`} className="font-medium hover:underline">
                      {row.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.request_number}</p>
                  </TableCell>
                  <TableCell>{row.project?.name ?? '—'}</TableCell>
                  <TableCell>{row.customer?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <ChangeRequestStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    {row.submitted_at
                      ? format(new Date(row.submitted_at), 'dd MMM yyyy')
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
