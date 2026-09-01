'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageHeader, PageMain, PageShell } from '@/components/layout/page'
import { useAuth } from '@/lib/hooks/use-auth'
import type { QualityChecklistTemplate, QualityChecklistTemplateDetail } from '@/lib/types/database'
import {
  updateTemplateItemFlagsAction,
  updateTemplateMetaAction,
  updateTemplateParameterAction,
} from '@/lib/quality/actions'
import { formatRequirement } from '@/lib/quality/validation'
import { Badge } from '@/components/ui/badge'

export function ChecklistSettingsContent() {
  const router = useRouter()
  const { isAdmin, isLoading: authLoading } = useAuth()
  const [templates, setTemplates] = useState<QualityChecklistTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [detail, setDetail] = useState<QualityChecklistTemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/login')
  }, [authLoading, isAdmin, router])

  const loadTemplates = useCallback(async () => {
    const res = await fetch('/api/quality/templates', { credentials: 'include' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(typeof body.error === 'string' ? body.error : 'Could not load templates.')
      return
    }
    const rows = (body.templates ?? []) as QualityChecklistTemplate[]
    setTemplates(rows)
    if (!selectedId && rows[0]) setSelectedId(rows[0].id)
  }, [selectedId])

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    void loadTemplates().finally(() => setLoading(false))
  }, [isAdmin, loadTemplates])

  useEffect(() => {
    if (!selectedId) return
    void fetch(`/api/quality/templates/${selectedId}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (res.ok) setDetail(body.template as QualityChecklistTemplateDetail)
      })
  }, [selectedId])

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Quality checklists"
          description="Reusable inspection templates. Project-specific requirements are overridden on the project, not here."
        />
        <Button variant="ghost" className="w-fit gap-2" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedId(template.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedId === template.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="block font-medium">{template.name}</span>
                    <span className="text-xs opacity-80">
                      {template.work_type} · v{template.version}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
            {detail ? <TemplateEditor detail={detail} onSaved={() => void loadTemplates()} /> : null}
          </div>
        )}
      </PageMain>
    </PageShell>
  )
}

function TemplateEditor({
  detail,
  onSaved,
}: {
  detail: QualityChecklistTemplateDetail
  onSaved: () => void
}) {
  const [name, setName] = useState(detail.name)
  const [description, setDescription] = useState(detail.description ?? '')
  const [requiresPm, setRequiresPm] = useState(detail.requires_pm_approval)
  const [published, setPublished] = useState(detail.is_published)

  useEffect(() => {
    setName(detail.name)
    setDescription(detail.description ?? '')
    setRequiresPm(detail.requires_pm_approval)
    setPublished(detail.is_published)
  }, [detail])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{detail.name}</CardTitle>
          <CardDescription>
            Changing defaults increments the template version. Existing inspections keep the
            requirements that were copied when they started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={requiresPm} onCheckedChange={setRequiresPm} />
              Requires PM approval
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={published} onCheckedChange={setPublished} />
              Published
            </label>
          </div>
          <Button
            onClick={async () => {
              const result = await updateTemplateMetaAction({
                templateId: detail.id,
                name,
                description,
                requiresPmApproval: requiresPm,
                isPublished: published,
              })
              if (!result.ok) toast.error(result.error)
              else {
                toast.success('Template updated.')
                onSaved()
              }
            }}
          >
            Save template
          </Button>
        </CardContent>
      </Card>
      {detail.items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {item.title}
              {item.is_critical ? <Badge variant="destructive">Critical</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <Switch
                  checked={item.is_critical}
                  onCheckedChange={async (checked) => {
                    const result = await updateTemplateItemFlagsAction({
                      itemId: item.id,
                      isCritical: checked,
                      isRequired: item.is_required,
                      allowNa: item.allow_na,
                    })
                    if (!result.ok) toast.error(result.error)
                    else onSaved()
                  }}
                />
                Critical
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={item.is_required}
                  onCheckedChange={async (checked) => {
                    const result = await updateTemplateItemFlagsAction({
                      itemId: item.id,
                      isCritical: item.is_critical,
                      isRequired: checked,
                      allowNa: item.allow_na,
                    })
                    if (!result.ok) toast.error(result.error)
                    else onSaved()
                  }}
                />
                Required
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={item.allow_na}
                  onCheckedChange={async (checked) => {
                    const result = await updateTemplateItemFlagsAction({
                      itemId: item.id,
                      isCritical: item.is_critical,
                      isRequired: item.is_required,
                      allowNa: checked,
                    })
                    if (!result.ok) toast.error(result.error)
                    else onSaved()
                  }}
                />
                Allow N/A
              </label>
            </div>
            {item.parameters.map((parameter) => (
              <ParameterEditor
                key={parameter.id}
                parameterId={parameter.id}
                name={parameter.name}
                defaultLabel={formatRequirement(parameter)}
                requirementLabel={parameter.requirement_label ?? ''}
                expectedValue={parameter.expected_value ?? ''}
                unit={parameter.unit ?? ''}
                minValue={parameter.min_value}
                maxValue={parameter.max_value}
                onSaved={onSaved}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ParameterEditor({
  parameterId,
  name,
  defaultLabel,
  requirementLabel,
  expectedValue,
  unit,
  minValue,
  maxValue,
  onSaved,
}: {
  parameterId: string
  name: string
  defaultLabel: string
  requirementLabel: string
  expectedValue: string
  unit: string
  minValue: number | null
  maxValue: number | null
  onSaved: () => void
}) {
  const [label, setLabel] = useState(requirementLabel)
  const [expected, setExpected] = useState(expectedValue)
  const [unitValue, setUnitValue] = useState(unit)
  const [min, setMin] = useState(minValue?.toString() ?? '')
  const [max, setMax] = useState(maxValue?.toString() ?? '')

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs text-muted-foreground">Shown as: {defaultLabel}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Requirement label" />
        <Input value={expected} onChange={(event) => setExpected(event.target.value)} placeholder="Expected" />
        <Input value={unitValue} onChange={(event) => setUnitValue(event.target.value)} placeholder="Unit" />
        <Input value={min} onChange={(event) => setMin(event.target.value)} placeholder="Min" />
        <Input value={max} onChange={(event) => setMax(event.target.value)} placeholder="Max" />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          const result = await updateTemplateParameterAction({
            parameterId,
            requirementLabel: label,
            expectedValue: expected,
            unit: unitValue,
            minValue: min ? Number(min) : null,
            maxValue: max ? Number(max) : null,
          })
          if (!result.ok) toast.error(result.error)
          else {
            toast.success('Parameter updated.')
            onSaved()
          }
        }}
      >
        Save parameter
      </Button>
    </div>
  )
}
