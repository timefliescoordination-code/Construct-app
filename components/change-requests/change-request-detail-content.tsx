'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChangeRequestCostingForm } from '@/components/change-requests/change-request-costing-form'
import { ChangeRequestStatusBadge } from '@/components/change-requests/change-request-status-badge'
import {
  adminOverrideChangeRequestAction,
  cancelChangeRequestAction,
  createPaymentRequestForChangeAction,
  pmApproveChangeRequestAction,
  pmRejectChangeRequestAction,
  saveCostingRevisionAction,
  scheduleChangeRequestAction,
  startChangeRequestReviewAction,
  submitChangeRequestForInternalApprovalAction,
  updateChangeRequestProgressAction,
  uploadChangeRequestAttachmentAction,
} from '@/lib/change-requests/actions'
import { formatINR } from '@/lib/currency'
import { useAuth } from '@/lib/hooks/use-auth'
import type { ConstructionChangeRequestDetail } from '@/lib/types/database'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ChangeRequestDetailContent({ requestId }: { requestId: string }) {
  const { isAdmin, role } = useAuth()
  const [detail, setDetail] = useState<ConstructionChangeRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideStatus, setOverrideStatus] = useState('under_review')
  const [paymentStage, setPaymentStage] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDue, setPaymentDue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const listRes = await fetch('/api/change-requests')
      const listBody = await listRes.json()
      const row = (listBody.requests ?? []).find((r: { id: string }) => r.id === requestId)
      if (!row) {
        setDetail(null)
        return
      }
      const detailRes = await fetch(
        `/api/projects/${row.project_id}/change-requests/${requestId}`,
      )
      const body = await detailRes.json()
      setDetail(body.request)
    } catch {
      toast.error('Failed to load change request')
    } finally {
      setLoading(false)
    }
  }, [requestId])

  const [milestones, setMilestones] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!detail?.project_id) return
    fetch(`/api/projects/${detail.project_id}`)
      .then((res) => res.json())
      .then((body) => {
        const list = body.data?.milestones ?? []
        setMilestones(list.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })))
      })
      .catch(() => setMilestones([]))
  }, [detail?.project_id])

  if (loading && !detail) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!detail) {
    return <p className="text-muted-foreground">Change request not found.</p>
  }

  const projectId = detail.project_id

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{detail.title}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.request_number} · {detail.project?.name}
          </p>
        </div>
        <ChangeRequestStatusBadge status={detail.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer request</CardTitle>
          <CardDescription>{detail.description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Category: {detail.category.replace(/_/g, ' ')}</p>
          {detail.customer_visible_explanation && (
            <p>Customer explanation: {detail.customer_visible_explanation}</p>
          )}
          {detail.internal_notes && role !== 'customer' && (
            <p className="text-muted-foreground">Internal notes: {detail.internal_notes}</p>
          )}
        </CardContent>
      </Card>

      {detail.status === 'submitted' && (
        <Button
          onClick={async () => {
            const result = await startChangeRequestReviewAction({ requestId, projectId })
            if (!result.ok) toast.error(result.error)
            else {
              toast.success('Review started')
              await load()
            }
          }}
        >
          Start review
        </Button>
      )}

      {(detail.status === 'submitted' ||
        detail.status === 'under_review' ||
        detail.status === 'costing_prepared' ||
        detail.status === 'internal_approval_pending' ||
        detail.status === 'customer_approval_pending') && (
        <Card>
          <CardHeader>
            <CardTitle>Costing</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangeRequestCostingForm
              milestones={milestones}
              onSubmit={async (payload) => {
                const result = await saveCostingRevisionAction({
                  requestId,
                  projectId,
                  rows: payload.rows,
                  estimatedAdditionalDays: payload.estimatedAdditionalDays,
                  affectedMilestoneId: payload.affectedMilestoneId,
                  internalNotes: payload.internalNotes,
                  customerVisibleExplanation: payload.customerVisibleExplanation,
                  reasonForChange: payload.reasonForChange,
                  moveToCostingPrepared: payload.moveToCostingPrepared,
                })
                if (!result.ok) toast.error(result.error)
                else {
                  toast.success('Costing saved')
                  await load()
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {detail.active_revision && (
        <p className="text-right font-semibold tabular-nums">
          Current estimate: {formatINR(Number(detail.active_revision.total_price))}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {detail.status === 'costing_prepared' && (
          <Button
            onClick={async () => {
              const result = await submitChangeRequestForInternalApprovalAction({
                requestId,
                projectId,
              })
              if (!result.ok) toast.error(result.error)
              else {
                toast.success('Sent for internal approval')
                await load()
              }
            }}
          >
            Submit for internal approval
          </Button>
        )}
        {detail.status === 'internal_approval_pending' && (role === 'pm' || isAdmin) && (
          <>
            <Button
              onClick={async () => {
                const result = await pmApproveChangeRequestAction({ requestId, projectId })
                if (!result.ok) toast.error(result.error)
                else {
                  toast.success('Sent to customer for approval')
                  await load()
                }
              }}
            >
              Approve & send to customer
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const result = await pmRejectChangeRequestAction({
                  requestId,
                  projectId,
                  comments: 'Rejected by PM',
                })
                if (!result.ok) toast.error(result.error)
                else await load()
              }}
            >
              Reject
            </Button>
          </>
        )}
        {detail.status === 'approved' && (role === 'pm' || isAdmin) && (
          <Button
            onClick={async () => {
              const result = await scheduleChangeRequestAction({
                requestId,
                projectId,
                milestoneId: detail.affected_milestone_id,
              })
              if (!result.ok) toast.error(result.error)
              else await load()
            }}
          >
            Mark scheduled
          </Button>
        )}
        {(detail.status === 'scheduled' || detail.status === 'approved') && (
          <Button
            onClick={async () => {
              const result = await updateChangeRequestProgressAction({
                requestId,
                projectId,
                status: 'in_progress',
              })
              if (!result.ok) toast.error(result.error)
              else await load()
            }}
          >
            Mark in progress
          </Button>
        )}
        {detail.status === 'in_progress' && (
          <Button
            onClick={async () => {
              const result = await updateChangeRequestProgressAction({
                requestId,
                projectId,
                status: 'completed',
              })
              if (!result.ok) toast.error(result.error)
              else await load()
            }}
          >
            Mark completed
          </Button>
        )}
        {(role === 'pm' || isAdmin) && detail.status !== 'cancelled' && (
          <Button
            variant="outline"
            onClick={async () => {
              const result = await cancelChangeRequestAction({
                requestId,
                projectId,
                reason: 'Cancelled by staff',
              })
              if (!result.ok) toast.error(result.error)
              else await load()
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      {detail.status === 'approved' && (role === 'pm' || isAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle>Create payment request</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Stage name</Label>
              <Input value={paymentStage} onChange={(e) => setPaymentStage(e.target.value)} />
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)} />
            </div>
            <Button
              className="sm:col-span-3"
              onClick={async () => {
                const result = await createPaymentRequestForChangeAction({
                  requestId,
                  projectId,
                  stageName: paymentStage,
                  amount: Number(paymentAmount),
                  dueDate: paymentDue,
                })
                if (!result.ok) toast.error(result.error)
                else toast.success('Payment request created')
              }}
            >
              Create payment request
            </Button>
          </CardContent>
        </Card>
      )}

      {detail.audit_events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audit history</CardTitle>
            <CardDescription>Status changes, approvals, and costing revisions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {detail.audit_events.map((event) => (
              <div key={event.id} className="rounded-lg border border-border/60 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{event.event_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.created_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
                {event.from_status && event.to_status ? (
                  <p className="text-muted-foreground">
                    {event.from_status.replace(/_/g, ' ')} → {event.to_status.replace(/_/g, ' ')}
                  </p>
                ) : null}
                {event.comments ? <p>{event.comments}</p> : null}
                {event.actor?.full_name ? (
                  <p className="text-xs text-muted-foreground">By {event.actor.full_name}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Admin override</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason (required)" />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
            >
              <option value="under_review">Under review</option>
              <option value="rejected">Rejected</option>
              <option value="customer_approval_pending">Customer approval pending</option>
              <option value="approved">Approved</option>
            </select>
            <Button
              onClick={async () => {
                const result = await adminOverrideChangeRequestAction({
                  requestId,
                  projectId,
                  toStatus: overrideStatus as ConstructionChangeRequestDetail['status'],
                  reason: overrideReason,
                })
                if (!result.ok) toast.error(result.error)
                else await load()
              }}
            >
              Apply override
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Internal attachment</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const fd = new FormData()
              fd.set('requestId', requestId)
              fd.set('projectId', projectId)
              fd.set('visibility', 'internal')
              fd.set('file', file)
              const result = await uploadChangeRequestAttachmentAction(fd)
              if (!result.ok) toast.error(result.error)
              else {
                toast.success('Attachment uploaded')
                await load()
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
