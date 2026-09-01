'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InspectionStatusBadge } from '@/components/quality/inspection-status-badge'
import {
  assignProjectChecklistAction,
  saveProjectParameterOverrideAction,
  startInspectionAction,
} from '@/lib/quality/actions'
import { canConfigureProjectQuality, canPerformInspection } from '@/lib/quality/workflow'
import { formatRequirement } from '@/lib/quality/validation'
import { useAuth } from '@/lib/hooks/use-auth'
import type {
  QualityChecklistTemplate,
  QualityChecklistTemplateDetail,
  QualityInspectionListRow,
  QualityProjectChecklist,
  QualityProjectParameterOverride,
  ProjectWithDetails,
} from '@/lib/types/database'
import type { QualityDashboardSummary } from '@/lib/quality/queries'
import { QUALITY_APPROVAL_STATUS_LABELS } from '@/lib/quality/constants'

type QualityPayload = {
  inspections: QualityInspectionListRow[]
  summary: QualityDashboardSummary
  assignments: QualityProjectChecklist[]
  overrides: QualityProjectParameterOverride[]
  templates: QualityChecklistTemplate[]
  templateDetail: QualityChecklistTemplateDetail | null
}

export function ProjectQualityTab({ project }: { project: ProjectWithDetails }) {
  const router = useRouter()
  const { role } = useAuth()
  const [data, setData] = useState<QualityPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [milestoneId, setMilestoneId] = useState(project.milestones?.[0]?.id ?? '')
  const [templateId, setTemplateId] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [requiresPm, setRequiresPm] = useState(true)
  const [starting, setStarting] = useState(false)
  const [overrideTemplateId, setOverrideTemplateId] = useState('')

  const canStart = canPerformInspection(role)
  const canConfigure = canConfigureProjectQuality(role)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (overrideTemplateId) params.set('templateId', overrideTemplateId)
    const res = await fetch(`/api/projects/${project.id}/quality?${params.toString()}`, {
      credentials: 'include',
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(typeof body.error === 'string' ? body.error : 'Could not load quality data.')
      return
    }
    setData(body as QualityPayload)
  }, [project.id, overrideTemplateId])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (!templateId && data?.templates[0]) setTemplateId(data.templates[0].id)
  }, [data?.templates, templateId])

  const currentMilestone = project.milestones?.find((row) => row.id === milestoneId)

  const start = async () => {
    if (!milestoneId) {
      toast.error('Select a construction stage.')
      return
    }
    setStarting(true)
    const result = await startInspectionAction({
      projectId: project.id,
      milestoneId,
      templateId: templateId || undefined,
      locationLabel,
    })
    setStarting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Inspection #${result.data.inspection_number} started.`)
    router.push(`/inspections/${result.data.id}`)
  }

  const assign = async () => {
    if (!milestoneId || !templateId) return
    const result = await assignProjectChecklistAction({
      projectId: project.id,
      milestoneId,
      templateId,
      requiresPmApproval: requiresPm,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success('Checklist assigned to this stage.')
    await load()
  }

  const grouped = useMemo(() => {
    const map = new Map<string, QualityInspectionListRow[]>()
    for (const row of data?.inspections ?? []) {
      const key = row.milestone?.name ?? 'Stage'
      map.set(key, [...(map.get(key) ?? []), row])
    }
    return map
  }, [data?.inspections])

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric title="Completed" value={data?.summary.completed ?? 0} />
        <Metric title="Pending" value={data?.summary.pending ?? 0} />
        <Metric title="Failed" value={data?.summary.failed ?? 0} />
        <Metric title="Open corrections" value={data?.summary.openCorrectiveActions ?? 0} />
        <Metric title="Reinspection" value={data?.summary.reinspectionPending ?? 0} />
        <Metric title="Approvals pending" value={data?.summary.approvalsPending ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start inspection</CardTitle>
          <CardDescription>
            Uses the existing project stage. Keep the checklist short — expand an item only when
            technical measurements are needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Construction stage</Label>
            <Select value={milestoneId} onValueChange={setMilestoneId}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {(project.milestones ?? []).map((milestone) => (
                  <SelectItem key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentMilestone?.quality_approval_status ? (
              <p className="text-xs text-muted-foreground">
                Quality:{' '}
                {QUALITY_APPROVAL_STATUS_LABELS[
                  currentMilestone.quality_approval_status as keyof typeof QUALITY_APPROVAL_STATUS_LABELS
                ] ?? currentMilestone.quality_approval_status}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Checklist</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                {(data?.templates ?? []).map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} v{template.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Location (optional)</Label>
            <Input
              value={locationLabel}
              onChange={(event) => setLocationLabel(event.target.value)}
              placeholder="Ground Floor"
            />
          </div>
          <div className="flex items-end gap-2">
            {canStart ? (
              <Button className="w-full" disabled={starting} onClick={() => void start()}>
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Start inspection
              </Button>
            ) : null}
          </div>
          {canConfigure ? (
            <div className="col-span-full flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Switch checked={requiresPm} onCheckedChange={setRequiresPm} />
                <Label>PM approval required to complete this stage</Label>
              </div>
              <Button variant="outline" size="sm" onClick={() => void assign()}>
                Assign checklist to stage
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {[...grouped.entries()].map(([stageName, rows]) => (
        <Card key={stageName}>
          <CardHeader>
            <CardTitle className="text-base">{stageName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/inspections/${row.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium">
                    Inspection #{row.inspection_number}
                    {row.location_label ? ` · ${row.location_label}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.work_label}</p>
                </div>
                <InspectionStatusBadge status={row.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      ))}

      {canConfigure ? (
        <Card>
          <CardHeader>
            <CardTitle>Project-specific requirements</CardTitle>
            <CardDescription>
              Override template defaults for this project only. Historical inspections keep the
              values that were snapshotted when they started.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={overrideTemplateId}
              onValueChange={(value) => setOverrideTemplateId(value)}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Choose a template to override" />
              </SelectTrigger>
              <SelectContent>
                {(data?.templates ?? []).map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data?.templateDetail?.items.map((item) => (
              <div key={item.id} className="space-y-2">
                <p className="text-sm font-medium">{item.title}</p>
                {item.parameters.map((parameter) => {
                  const override = data.overrides.find(
                    (row) => row.template_parameter_id === parameter.id,
                  )
                  return (
                    <OverrideRow
                      key={parameter.id}
                      projectId={project.id}
                      parameterId={parameter.id}
                      name={parameter.name}
                      defaultLabel={formatRequirement(parameter)}
                      override={override ?? null}
                      onSaved={() => void load()}
                    />
                  )
                })}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold tabular-nums">{value}</CardContent>
    </Card>
  )
}

function OverrideRow({
  projectId,
  parameterId,
  name,
  defaultLabel,
  override,
  onSaved,
}: {
  projectId: string
  parameterId: string
  name: string
  defaultLabel: string
  override: QualityProjectParameterOverride | null
  onSaved: () => void
}) {
  const [value, setValue] = useState(
    override?.requirement_label || override?.expected_value || '',
  )
  const [saving, setSaving] = useState(false)

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-1">
        <Label>{name}</Label>
        <p className="text-xs text-muted-foreground">Template default: {defaultLabel}</p>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Project requirement (e.g. 1:5)"
        />
      </div>
      <Button
        variant="outline"
        disabled={saving || !value.trim()}
        onClick={async () => {
          setSaving(true)
          const result = await saveProjectParameterOverrideAction({
            projectId,
            templateParameterId: parameterId,
            requirementLabel: value,
            expectedValue: value,
          })
          setSaving(false)
          if (!result.ok) toast.error(result.error)
          else {
            toast.success('Project requirement saved.')
            onSaved()
          }
        }}
      >
        Save override
      </Button>
    </div>
  )
}
