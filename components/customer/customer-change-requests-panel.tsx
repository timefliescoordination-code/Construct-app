'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { FileText, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChangeRequestStatusBadge } from '@/components/change-requests/change-request-status-badge'
import { CHANGE_REQUEST_CATEGORIES } from '@/lib/change-requests/constants'
import {
  cancelChangeRequestAction,
  createChangeRequestAction,
  customerDecisionOnChangeRequestAction,
  returnChangeRequestToReviewAction,
  submitChangeRequestAction,
  updateChangeRequestAction,
  uploadChangeRequestAttachmentAction,
} from '@/lib/change-requests/actions'
import { canCustomerEdit, canCustomerCancel } from '@/lib/change-requests/workflow'
import { formatINR } from '@/lib/currency'
import type {
  ChangeRequestCategory,
  ChangeRequestStatus,
  ConstructionChangeRequestDetail,
  Milestone,
  ProjectWithDetails,
} from '@/lib/types/database'

type ListItem = {
  id: string
  request_number: string
  title: string
  category: string
  status: ChangeRequestStatus
  created_at: string
  submitted_at: string | null
}

export function CustomerChangeRequestsPanel({
  project,
  selectedRequestId,
}: {
  project: ProjectWithDetails
  selectedRequestId?: string
}) {
  const [requests, setRequests] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [detail, setDetail] = useState<ConstructionChangeRequestDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/change-requests`)
      const body = await res.json()
      setRequests(body.requests ?? [])
    } catch {
      toast.error('Failed to load change requests')
    } finally {
      setLoading(false)
    }
  }, [project.id])

  const loadDetail = useCallback(
    async (requestId: string) => {
      setDetailLoading(true)
      try {
        const res = await fetch(`/api/projects/${project.id}/change-requests/${requestId}`)
        const body = await res.json()
        setDetail(body.request ?? null)
      } catch {
        toast.error('Failed to load request details')
      } finally {
        setDetailLoading(false)
      }
    },
    [project.id],
  )

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    if (selectedRequestId) loadDetail(selectedRequestId)
  }, [selectedRequestId, loadDetail])

  const handleAccept = async () => {
    if (!detail) return
    const result = await customerDecisionOnChangeRequestAction({
      requestId: detail.id,
      projectId: project.id,
      decision: 'accepted',
      confirmationText,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success('Change request accepted')
    setConfirmationText('')
    await loadDetail(detail.id)
    await loadList()
  }

  const handleReject = async () => {
    if (!detail) return
    const result = await customerDecisionOnChangeRequestAction({
      requestId: detail.id,
      projectId: project.id,
      decision: 'rejected',
      confirmationText,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success('Change request rejected')
    setConfirmationText('')
    await loadDetail(detail.id)
    await loadList()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Change requests</h2>
          <p className="text-sm text-muted-foreground">
            Request construction changes during your build. Our team will review and provide a cost estimate.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Request a change
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No change requests yet. Use &quot;Request a change&quot; to submit your first request.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {requests.map((req) => (
            <Card
              key={req.id}
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => loadDetail(req.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{req.title}</CardTitle>
                  <ChangeRequestStatusBadge status={req.status} />
                </div>
                <CardDescription>
                  {req.request_number} · Submitted{' '}
                  {req.submitted_at
                    ? format(new Date(req.submitted_at), 'dd MMM yyyy')
                    : format(new Date(req.created_at), 'dd MMM yyyy')}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {detail && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{detail.title}</CardTitle>
              <ChangeRequestStatusBadge status={detail.status} />
            </div>
            <CardDescription>
              {detail.request_number} · {detail.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading && <Loader2 className="h-5 w-5 animate-spin" />}

            {detail.active_revision && detail.status === 'customer_approval_pending' && (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="font-medium">Estimate for your approval</p>
                {detail.customer_visible_explanation && (
                  <p className="text-sm">{detail.customer_visible_explanation}</p>
                )}
                <div className="space-y-1 text-sm">
                  {detail.active_revision.rows?.map((row) => (
                    <div key={row.id} className="flex justify-between gap-4">
                      <span>{row.description} ({row.unit})</span>
                      <span className="tabular-nums">{formatINR(Number(row.price))}</span>
                    </div>
                  ))}
                </div>
                <p className="text-right font-semibold tabular-nums">
                  Total: {formatINR(Number(detail.active_revision.total_price))}
                </p>
                {detail.estimated_additional_days != null && (
                  <p className="text-sm text-muted-foreground">
                    Estimated schedule impact: +{detail.estimated_additional_days} days
                  </p>
                )}
                <Textarea
                  placeholder="Type your confirmation (e.g. I accept the scope and price)"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleAccept}>Accept estimate</Button>
                  <Button variant="outline" onClick={handleReject}>Reject estimate</Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const result = await returnChangeRequestToReviewAction({
                        requestId: detail.id,
                        projectId: project.id,
                        comments: confirmationText,
                      })
                      if (!result.ok) toast.error(result.error)
                      else {
                        toast.success('Returned for revised quote')
                        await loadDetail(detail.id)
                        await loadList()
                      }
                    }}
                  >
                    Request revised quote
                  </Button>
                </div>
              </div>
            )}

            {detail.attachments?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Attachments</p>
                <ul className="space-y-1 text-sm">
                  {detail.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        className="text-primary hover:underline"
                        href={`/api/projects/${project.id}/change-requests/${detail.id}/attachments/${a.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText className="mr-1 inline h-4 w-4" />
                        {a.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canCustomerCancel(detail.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const result = await cancelChangeRequestAction({
                    requestId: detail.id,
                    projectId: project.id,
                  })
                  if (!result.ok) toast.error(result.error)
                  else {
                    toast.success('Request cancelled')
                    setDetail(null)
                    await loadList()
                  }
                }}
              >
                Cancel request
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <CustomerChangeRequestFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={project}
        onSuccess={async () => {
          setFormOpen(false)
          await loadList()
        }}
      />
    </div>
  )
}

function CustomerChangeRequestFormDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectWithDetails
  onSuccess: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ChangeRequestCategory>('other')
  const [milestoneId, setMilestoneId] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const milestones = project.milestones ?? []

  const handleSubmit = async (submit: boolean) => {
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required')
      return
    }
    setLoading(true)
    try {
      const result = await createChangeRequestAction({
        projectId: project.id,
        title,
        description,
        category,
        relatedMilestoneId: milestoneId || null,
        preferredCompletionDate: preferredDate || null,
        submit,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      if (file && result.data) {
        const fd = new FormData()
        fd.set('requestId', result.data.id)
        fd.set('projectId', project.id)
        fd.set('visibility', 'customer')
        fd.set('file', file)
        const upload = await uploadChangeRequestAttachmentAction(fd)
        if (!upload.ok) toast.error(upload.error)
      }

      toast.success(submit ? 'Change request submitted' : 'Draft saved')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Change title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div>
            <Label>Category</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as ChangeRequestCategory)}
            >
              {CHANGE_REQUEST_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {milestones.length > 0 && (
            <div>
              <Label>Related milestone (optional)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
              >
                <option value="">None</option>
                {milestones.map((m: Milestone) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>Preferred completion date (optional)</Label>
            <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
          </div>
          <div>
            <Label>Attachment (photo, drawing, document)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button disabled={loading} onClick={() => handleSubmit(true)}>Submit request</Button>
            <Button disabled={loading} variant="outline" onClick={() => handleSubmit(false)}>Save draft</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
