'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { QualityInspectionParameterResult } from '@/lib/types/database'
import { formatRequirement } from '@/lib/quality/validation'
import { ItemStatusBadge } from '@/components/quality/inspection-status-badge'
import { cn } from '@/lib/utils'

function parseMulti(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    /* ignore */
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export function ParameterFields({
  parameter,
  disabled,
  onSave,
}: {
  parameter: QualityInspectionParameterResult
  disabled?: boolean
  onSave: (actualValue: string) => void
}) {
  const required = formatRequirement(parameter)

  if (parameter.parameter_type === 'boolean') {
    const yes = parameter.actual_value === 'yes'
    const no = parameter.actual_value === 'no'
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <ParameterHeader parameter={parameter} required={required} />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            variant={yes ? 'default' : 'outline'}
            className={cn(yes && 'bg-green-600 hover:bg-green-600/90')}
            onClick={() => onSave('yes')}
          >
            Yes
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            variant={no ? 'default' : 'outline'}
            className={cn(no && 'bg-destructive hover:bg-destructive/90')}
            onClick={() => onSave('no')}
          >
            No
          </Button>
        </div>
      </div>
    )
  }

  if (parameter.parameter_type === 'single_select') {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <ParameterHeader parameter={parameter} required={required} />
        <div className="flex flex-wrap gap-2">
          {parameter.options.map((option) => {
            const active = parameter.actual_value === option.value
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                disabled={disabled}
                variant={active ? 'default' : 'outline'}
                onClick={() => onSave(option.value)}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  if (parameter.parameter_type === 'multi_select') {
    const selected = parseMulti(parameter.actual_value)
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <ParameterHeader parameter={parameter} required={required} />
        <div className="space-y-2">
          {parameter.options.map((option) => {
            const checked = selected.includes(option.value)
            return (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(next) => {
                    const set = new Set(selected)
                    if (next) set.add(option.value)
                    else set.delete(option.value)
                    onSave(JSON.stringify([...set]))
                  }}
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  if (parameter.parameter_type === 'text') {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <ParameterHeader parameter={parameter} required={required} />
        <Textarea
          defaultValue={parameter.actual_value ?? ''}
          disabled={disabled}
          rows={2}
          onBlur={(event) => onSave(event.target.value)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <ParameterHeader parameter={parameter} required={required} />
      <div className="flex items-center gap-2">
        <Input
          defaultValue={parameter.actual_value ?? ''}
          disabled={disabled}
          inputMode={parameter.parameter_type === 'ratio' ? 'text' : 'decimal'}
          placeholder={parameter.parameter_type === 'ratio' ? '1:6' : 'Actual'}
          onBlur={(event) => onSave(event.target.value)}
        />
        {parameter.unit ? (
          <span className="text-sm text-muted-foreground">{parameter.unit}</span>
        ) : null}
      </div>
    </div>
  )
}

function ParameterHeader({
  parameter,
  required,
}: {
  parameter: QualityInspectionParameterResult
  required: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label className="text-sm font-medium">{parameter.name}</Label>
        <p className="text-xs text-muted-foreground">Required: {required}</p>
      </div>
      <ItemStatusBadge status={parameter.status} />
    </div>
  )
}
