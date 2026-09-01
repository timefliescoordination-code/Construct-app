'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { InspectionStatusBadge } from '@/components/quality/inspection-status-badge'
import { InspectionChecklist } from '@/components/quality/inspection-checklist'
import {
  fetchProjectStaffOptionsAction,
  requestReinspectionAction,
  reviewInspectionAction,
  submitInspectionAction,
  uploadInspectionPhotoAction,
} from '@/lib/quality/actions'
import { canEditInspectionResults, canReviewInspection } from '@/lib/quality/workflow'
import { useAuth } from '@/lib/hooks/use-auth'
import type { QualityInspectionDetail } from '@/lib/types/database'
import { QUALITY_APPROVAL_DECISIONS, type QualityApprovalDecision } from '@/lib/quality/constants'

export function InspectionDetailContent({ inspectionId }: { inspectionId: string }) {
  const router = useRouter()
  const { role } = useAuth()
  const [inspection, setInspection] = useState<QualityInspectionDetail | null>(null)
  const [staff, setStaff] = useState<Array<{ id: string; full_name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reviewRemark, setReviewRemark] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/quality/inspections/${inspectionId}`, { credentials: 'include' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof body.error === 'string' ? body.error : 'Could not load inspection.')
      setInspection(null)
      return
    }
    setInspection(body.inspection as QualityInspectionDetail)
    setError(null)
  }, [inspectionId])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (!inspection?.project_id) return
    void fetchProjectStaffOptionsAction(inspection.project_id).then((result) => {
      if (result.ok) setStaff(result.data)
    })
  }, [inspection?.project_id])

  const canEdit = useMemo(
    () => (inspection ? canEditInspectionResults(role, inspection.status) : false),
    [inspection, role],
  )
  const canReview = useMemo(
    () => (inspection ? canReviewInspection(role) : false),
    [inspection, role],
  )

  const failedItems = inspection?.items.filter((item) => item.status === 'fail') ?? []
  const criticalFails = failedItems.filter((item) => item.is_critical)

  const submit = async () => {
    setBusy(true)
    const result = await submitInspectionAction({ inspectionId })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Inspection ${result.data.status.replaceAll('_', ' ')}.`)
    await load()
  }

  const reinspect = async () => {
    setBusy(true)
    const result = await requestReinspectionAction({ inspectionId })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Reinspection #${result.data.inspection_number} created.`)
    router.push(`/inspections/${result.data.id}`)
  }

  const review = async (decision: QualityApprovalDecision) => {
    setBusy(true)
    const result = await reviewInspectionAction({
      inspectionId,
      decision,
      remark: reviewRemark,
    })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Inspection ${result.data.status.replaceAll('_', ' ')}.`)
    await load()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!inspection) {
    return <p className="text-muted-foreground">{error ?? 'Inspection not found.'}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1" asChild>
            <Link href={`/projects/${inspection.project_id}?tab=quality`}>
              <ArrowLeft className="h-4 w-4" />
              Back to project quality
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {inspection.work_label} #{inspection.inspection_number}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {inspection.project?.name} · {inspection.milestone?.name}
            {inspection.location_label ? ` · ${inspection.location_label}` : ''}
            {inspection.template ? ` · v${inspection.template_version}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <InspectionStatusBadge status={inspection.status} />
            {inspection.starter?.full_name ? (
              <span className="text-sm text-muted-foreground">
                Engineer: {inspection.starter.full_name}
              </span>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {format(new Date(inspection.created_at), 'dd MMM yyyy HH:mm')}
            </span>
            {inspection.parent ? (
              <Link
                href={`/inspections/${inspection.parent.id}`}
                className="text-sm text-primary hover:underline"
              >
                Reinspection of #{inspection.parent.inspection_number}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const formData = new FormData()
              formData.set('inspectionId', inspection.id)
              formData.set('level', 'inspection')
              formData.set('file', file)
              const result = await uploadInspectionPhotoAction(formData)
              if (!result.ok) toast.error(result.error)
              else {
                toast.success('Inspection photo added.')
                await load()
              }
            }}
          />
          {canEdit ? (
            <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" />
              Inspection photo
            </Button>
          ) : null}
        </div>
      </div>

      {criticalFails.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">
              {criticalFails.length} critical failure{criticalFails.length === 1 ? '' : 's'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {criticalFails.map((item) => item.title).join(', ')}
          </CardContent>
        </Card>
      ) : null}

      <InspectionChecklist
        inspection={inspection}
        staff={staff}
        canEdit={canEdit}
        onChanged={() => void load()}
      />

      {inspection.photos.filter((photo) => photo.level === 'inspection').length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspection photos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {inspection.photos
              .filter((photo) => photo.level === 'inspection')
              .map((photo) => (
                <a
                  key={photo.id}
                  href={`/api/quality/inspections/${inspection.id}/photos/${photo.id}/view`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/quality/inspections/${inspection.id}/photos/${photo.id}/view`}
                    alt={photo.file_name}
                    className="h-24 w-full rounded-md object-cover"
                  />
                </a>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-12 flex-1 text-base" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit inspection
          </Button>
          {['failed', 'awaiting_correction', 'ready_for_reinspection', 'rejected'].includes(
            inspection.status,
          ) ? (
            <Button
              variant="outline"
              className="h-12 flex-1"
              disabled={busy}
              onClick={() => void reinspect()}
            >
              Request reinspection
            </Button>
          ) : null}
        </div>
      ) : null}

      {canReview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PM review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failedItems.length > 0 ? (
              <p className="text-sm text-destructive">
                Failed items: {failedItems.map((item) => item.title).join(', ')}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No failed items on this inspection.</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="pm-remark">Remark</Label>
              <Textarea
                id="pm-remark"
                value={reviewRemark}
                onChange={(event) => setReviewRemark(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {QUALITY_APPROVAL_DECISIONS.map((decision) => (
                <Button
                  key={decision}
                  type="button"
                  disabled={busy || inspection.status === 'approved'}
                  variant={decision === 'approved' ? 'default' : 'outline'}
                  onClick={() => void review(decision)}
                >
                  {decision === 'approved'
                    ? 'Approve'
                    : decision === 'rejected'
                      ? 'Reject'
                      : 'Request correction'}
                </Button>
              ))}
            </div>
            {inspection.approvals.length > 0 ? (
              <div className="space-y-2 border-t pt-3 text-sm">
                {inspection.approvals.map((approval) => (
                  <p key={approval.id}>
                    <span className="font-medium capitalize">
                      {approval.decision.replaceAll('_', ' ')}
                    </span>
                    {approval.actor?.full_name ? ` · ${approval.actor.full_name}` : ''}
                    {' · '}
                    {format(new Date(approval.created_at), 'dd MMM yyyy HH:mm')}
                    {approval.remark ? ` — ${approval.remark}` : ''}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {inspection.audit_events.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {inspection.audit_events.map((event) => (
              <div key={event.id} className="flex flex-wrap gap-2 border-b border-border/60 py-2 last:border-0">
                <span className="font-medium">{event.event_type.replaceAll('_', ' ')}</span>
                {event.from_status && event.to_status ? (
                  <span className="text-muted-foreground">
                    {event.from_status} → {event.to_status}
                  </span>
                ) : null}
                <span className="text-muted-foreground">
                  {event.actor?.full_name ?? 'System'} ·{' '}
                  {format(new Date(event.created_at), 'dd MMM yyyy HH:mm')}
                </span>
                {event.comments ? <span>{event.comments}</span> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
