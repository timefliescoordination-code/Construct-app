'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { FileText, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProposalStatusBadge } from '@/components/proposals/proposal-status-badge'
import { formatINR } from '@/lib/currency'
import { PROPOSAL_METHOD_LABELS } from '@/lib/proposals/constants'
import { proposalDisplayClient, proposalDisplayName } from '@/lib/proposals/access'
import type { ProposalListRow } from '@/lib/proposals/types'
import { ScrollTable } from '@/components/layout/scroll-table'

export function ProposalsList({ projectId }: { projectId?: string }) {
  const [rows, setRows] = useState<ProposalListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', projectId)
      const res = await fetch(`/api/proposals?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Could not load proposals.')
      }
      setRows(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load proposals.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">{error}</CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No proposals yet</EmptyTitle>
          <EmptyDescription>
            {projectId
              ? 'No proposals have been moved onto this project yet.'
              : 'Create a proposal with a proposed project name and address. It is added to the project list only when you move it.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {projectId ? null : (
            <Button asChild>
              <Link href="/proposals/new">
                <Plus className="mr-2 h-4 w-4" />
                Create proposal
              </Link>
            </Button>
          )}
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <ScrollTable minWidth="min-w-[72rem]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proposal No.</TableHead>
            <TableHead>Proposed project</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Version</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Client viewed</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const version = row.current_version
            const viewed = Boolean(version?.first_viewed_at)
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/proposals/${row.id}`} className="hover:underline">
                    {row.proposal_number}
                  </Link>
                  {row.open_revision_count ? (
                    <p className="text-xs text-amber-700">
                      {row.open_revision_count} revision request
                      {row.open_revision_count === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div>{proposalDisplayName(row) || '—'}</div>
                  {row.project_id ? (
                    <p className="text-xs text-muted-foreground">On project list</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Proposal only</p>
                  )}
                </TableCell>
                <TableCell>{proposalDisplayClient(row) || '—'}</TableCell>
                <TableCell>
                  {version?.method ? PROPOSAL_METHOD_LABELS[version.method] : '—'}
                </TableCell>
                <TableCell>{version?.version_number ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(Number(version?.grand_total ?? 0))}
                </TableCell>
                <TableCell>
                  <ProposalStatusBadge status={row.status} />
                </TableCell>
                <TableCell>{row.created_by_profile?.full_name || '—'}</TableCell>
                <TableCell>{format(new Date(row.created_at), 'd MMM yyyy')}</TableCell>
                <TableCell>{format(new Date(row.updated_at), 'd MMM yyyy')}</TableCell>
                <TableCell>
                  {viewed ? (
                    <span>
                      Viewed
                      {version?.last_viewed_at ? (
                        <span className="block text-xs text-muted-foreground">
                          {format(new Date(version.last_viewed_at), 'd MMM yyyy, h:mm a')}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    'Not viewed'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/proposals/${row.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ScrollTable>
  )
}
