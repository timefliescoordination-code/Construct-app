'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { COSTING_UNIT_SUGGESTIONS } from '@/lib/change-requests/constants'
import { formatINR } from '@/lib/currency'

export type CostingRowState = { description: string; unit: string; price: string }

type ChangeRequestCostingFormProps = {
  initialRows?: CostingRowState[]
  estimatedAdditionalDays?: string
  affectedMilestoneId?: string
  internalNotes?: string
  customerVisibleExplanation?: string
  reasonForChange?: string
  milestones?: Array<{ id: string; name: string }>
  onSubmit: (payload: {
    rows: Array<{ description: string; unit: string; price: number }>
    estimatedAdditionalDays?: number | null
    affectedMilestoneId?: string | null
    internalNotes?: string | null
    customerVisibleExplanation?: string | null
    reasonForChange?: string | null
    moveToCostingPrepared?: boolean
  }) => Promise<void>
  submitLabel?: string
}

export function ChangeRequestCostingForm({
  initialRows,
  estimatedAdditionalDays: initialDays,
  affectedMilestoneId: initialMilestone,
  internalNotes: initialInternal,
  customerVisibleExplanation: initialCustomer,
  reasonForChange: initialReason,
  milestones = [],
  onSubmit,
  submitLabel = 'Save costing',
}: ChangeRequestCostingFormProps) {
  const [rows, setRows] = useState<CostingRowState[]>(
    initialRows?.length
      ? initialRows
      : [{ description: '', unit: 'item', price: '' }],
  )
  const [estimatedDays, setEstimatedDays] = useState(initialDays ?? '')
  const [milestoneId, setMilestoneId] = useState(initialMilestone ?? '')
  const [internalNotes, setInternalNotes] = useState(initialInternal ?? '')
  const [customerExplanation, setCustomerExplanation] = useState(initialCustomer ?? '')
  const [reason, setReason] = useState(initialReason ?? '')
  const [loading, setLoading] = useState(false)

  const total = useMemo(
    () =>
      rows.reduce((sum, row) => sum + (Number(row.price) || 0), 0),
    [rows],
  )

  const handleSubmit = async (moveToCostingPrepared?: boolean) => {
    const parsed = rows
      .filter((r) => r.description.trim())
      .map((r) => ({
        description: r.description.trim(),
        unit: r.unit.trim() || 'item',
        price: Number(r.price) || 0,
      }))

    if (!parsed.length) return

    setLoading(true)
    try {
      await onSubmit({
        rows: parsed,
        estimatedAdditionalDays: estimatedDays ? Number(estimatedDays) : null,
        affectedMilestoneId: milestoneId || null,
        internalNotes: internalNotes.trim() || null,
        customerVisibleExplanation: customerExplanation.trim() || null,
        reasonForChange: reason.trim() || null,
        moveToCostingPrepared,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_120px_auto] items-end">
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={row.description}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)),
                  )
                }
                placeholder="Work description"
              />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Input
                value={row.unit}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, unit: e.target.value } : r)),
                  )
                }
                placeholder="sqft, item, …"
                list="costing-unit-suggestions"
              />
            </div>
            <div>
              <Label className="text-xs">Price (₹)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.price}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, price: e.target.value } : r)),
                  )
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              disabled={rows.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <datalist id="costing-unit-suggestions">
          {COSTING_UNIT_SUGGESTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((prev) => [...prev, { description: '', unit: 'item', price: '' }])}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add row
        </Button>
      </div>

      <div className="flex justify-end text-lg font-semibold tabular-nums">
        Total: {formatINR(total)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Estimated additional days</Label>
          <Input type="number" min={0} value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} />
        </div>
        {milestones.length > 0 && (
          <div>
            <Label>Affected milestone</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
            >
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <Label>Customer-visible explanation</Label>
        <Textarea value={customerExplanation} onChange={(e) => setCustomerExplanation(e.target.value)} rows={2} />
      </div>
      <div>
        <Label>Internal notes (staff only)</Label>
        <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} />
      </div>
      <div>
        <Label>Reason for revision</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={loading} onClick={() => handleSubmit(false)}>
          {submitLabel}
        </Button>
        <Button disabled={loading} variant="secondary" onClick={() => handleSubmit(true)}>
          Save & mark costing prepared
        </Button>
      </div>
    </div>
  )
}
