'use client'

import { ArrowDown, ArrowUp, IndentIncrease, Plus, Ruler, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BoqExcelImport } from '@/components/proposals/boq-excel-import'
import { ProposalUnitSelect } from '@/components/proposals/proposal-unit-select'
import { formatINR } from '@/lib/currency'
import { linePrice } from '@/lib/proposals/calculations'
import {
  boqSerialLabel,
  emptyBoqMeasurements,
  hasMeasurementValues,
  headingOwnsUntil,
  isChildRow,
  isHeading,
  moveItemBlock,
  quantityFromMeasurements,
  rowUsesMeasurements,
} from '@/lib/proposals/boq-structure'
import { defaultUnitForSection, type ProposalItemSection } from '@/lib/proposals/constants'
import type { BoqMeasurements, ProposalItemDraft } from '@/lib/proposals/types'
import { cn } from '@/lib/utils'

type ProposalItemsEditorProps = {
  section: ProposalItemSection
  title: string
  items: ProposalItemDraft[]
  onChange: (items: ProposalItemDraft[]) => void
  emptyHint?: string
}

function emptyLine(section: ProposalItemSection, nested = false): ProposalItemDraft {
  return {
    section,
    description: '',
    quantity: '',
    unit: defaultUnitForSection(section),
    rate: '',
    kind: 'item',
    measurements: null,
    nested,
  }
}

function emptyHeading(section: ProposalItemSection): ProposalItemDraft {
  return {
    section,
    description: '',
    quantity: '',
    unit: '',
    rate: '',
    kind: 'heading',
    measurements: null,
    nested: false,
  }
}

function billedQuantity(item: ProposalItemDraft): number {
  if (isHeading(item)) return 0
  return quantityFromMeasurements(item.measurements, item.quantity)
}

function billedPrice(item: ProposalItemDraft): number {
  if (isHeading(item)) return 0
  return linePrice(billedQuantity(item), item.rate)
}

export function ProposalItemsEditor({
  section,
  title,
  items,
  onChange,
  emptyHint,
}: ProposalItemsEditorProps) {
  const rows = items.filter((item) => item.section === section)
  const isBoq = section === 'boq'
  const showMeasurements = isBoq && rows.some((item) => rowUsesMeasurements(item))
  const columnCount = (showMeasurements ? 11 : 7)
  const sectionTotal = rows.reduce((sum, item) => sum + billedPrice(item), 0)

  const insertAt = (index: number, row: ProposalItemDraft) => {
    onChange([...items.slice(0, index), row, ...items.slice(index)])
  }

  const updateRow = (index: number, patch: Partial<ProposalItemDraft>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const addRow = () => {
    onChange([...items, emptyLine(section)])
  }

  const addGroup = () => {
    onChange([...items, emptyHeading(section)])
  }

  const addSubItem = (index: number) => {
    const item = items[index]
    if (!item || item.section !== section) return
    if (isHeading(item)) {
      insertAt(headingOwnsUntil(items, index) + 1, emptyLine(section, true))
      return
    }
    if (isChildRow(items, index)) {
      insertAt(index + 1, emptyLine(section, true))
      return
    }
    const child: ProposalItemDraft = {
      ...item,
      kind: 'item',
      description: item.description,
      nested: true,
    }
    const heading: ProposalItemDraft = {
      ...item,
      kind: 'heading',
      quantity: '',
      unit: '',
      rate: '',
      measurements: null,
      nested: false,
    }
    onChange([...items.slice(0, index), heading, child, ...items.slice(index + 1)])
  }

  const removeRow = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    onChange(moveItemBlock(items, index, direction))
  }

  const setMeasurements = (index: number, measurements: BoqMeasurements | null) => {
    updateRow(index, { measurements })
  }

  const updateMeasurement = (index: number, field: keyof BoqMeasurements, value: string) => {
    const item = items[index]
    if (!item) return
    const current = item.measurements ?? emptyBoqMeasurements()
    setMeasurements(index, { ...current, [field]: value })
  }

  const groupTotal = (headingIndex: number) => {
    const end = headingOwnsUntil(items, headingIndex)
    let sum = 0
    for (let i = headingIndex + 1; i <= end; i++) {
      const item = items[i]
      if (!item || item.section !== section) continue
      sum += billedPrice(item)
    }
    return sum
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {emptyHint ? <p className="text-sm text-muted-foreground">{emptyHint}</p> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Section total <span className="font-semibold text-foreground">{formatINR(sectionTotal)}</span>
        </p>
      </div>

      {isBoq ? <BoqExcelImport items={items} onChange={onChange} /> : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className={cn('w-full text-sm', showMeasurements ? 'min-w-[68rem]' : 'min-w-[52rem]')}>
          <thead className="bg-muted/50 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">S.No</th>
              <th className="px-3 py-2">Description</th>
              {showMeasurements ? (
                <>
                  <th className="px-2 py-2">Nos</th>
                  <th className="px-2 py-2">L</th>
                  <th className="px-2 py-2">B</th>
                  <th className="px-2 py-2">H</th>
                </>
              ) : null}
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-3 py-8 text-center text-muted-foreground">
                  {isBoq
                    ? 'No items yet. Upload an Excel file or add items one by one.'
                    : 'No items yet.'}
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                if (item.section !== section) return null
                const heading = isHeading(item)
                const child = isChildRow(items, index)
                const serial = isBoq
                  ? boqSerialLabel(items, index, section)
                  : String(items.slice(0, index + 1).filter((row) => row.section === section).length)
                const measured = hasMeasurementValues(item.measurements)
                const qtyDisplay = heading
                  ? ''
                  : measured
                    ? String(quantityFromMeasurements(item.measurements, item.quantity))
                    : item.quantity
                const price = heading ? groupTotal(index) : billedPrice(item)
                return (
                  <tr
                    key={`${section}-${index}`}
                    className={cn('border-t border-border', heading && 'bg-muted/30')}
                  >
                    <td className="px-3 py-2 align-top text-muted-foreground">{serial}</td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        value={item.description}
                        onChange={(e) => updateRow(index, { description: e.target.value })}
                        placeholder={heading ? 'Group name, e.g. Concrete quantity' : 'Description'}
                        className={cn(child && 'ml-6', heading && 'font-semibold')}
                      />
                    </td>
                    {showMeasurements
                      ? (['nos', 'length', 'breadth', 'height'] as const).map((field) => (
                          <td key={field} className="w-20 px-2 py-2 align-top">
                            {heading ? null : (
                              <Input
                                inputMode="decimal"
                                value={item.measurements?.[field] ?? ''}
                                onChange={(e) => updateMeasurement(index, field, e.target.value)}
                                placeholder=""
                                disabled={!rowUsesMeasurements(item)}
                              />
                            )}
                          </td>
                        ))
                      : null}
                    <td className="w-28 px-3 py-2 align-top">
                      {heading ? null : (
                        <Input
                          inputMode="decimal"
                          value={qtyDisplay}
                          onChange={(e) => updateRow(index, { quantity: e.target.value })}
                          placeholder="0"
                          readOnly={measured}
                          className={measured ? 'bg-muted/40' : undefined}
                        />
                      )}
                    </td>
                    <td className="w-36 px-3 py-2 align-top">
                      {heading ? null : (
                        <ProposalUnitSelect
                          value={item.unit}
                          onChange={(unit) => updateRow(index, { unit })}
                        />
                      )}
                    </td>
                    <td className="w-32 px-3 py-2 align-top">
                      {heading ? null : (
                        <Input
                          inputMode="decimal"
                          value={item.rate}
                          onChange={(e) => updateRow(index, { rate: e.target.value })}
                          placeholder="0"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-right font-medium tabular-nums">
                      {formatINR(price)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex justify-end gap-1">
                        {isBoq ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => addSubItem(index)}
                              aria-label="Add sub-item"
                              title="Add sub-item"
                            >
                              <IndentIncrease className="h-4 w-4" />
                            </Button>
                            {heading ? null : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setMeasurements(
                                    index,
                                    rowUsesMeasurements(item) ? null : emptyBoqMeasurements(),
                                  )
                                }
                                aria-label={
                                  rowUsesMeasurements(item) ? 'Clear measurements' : 'Add measurements'
                                }
                                title={
                                  rowUsesMeasurements(item) ? 'Clear measurements' : 'Add measurements'
                                }
                              >
                                <Ruler className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveRow(index, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveRow(index, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeRow(index)}
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="gap-2" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add item
        </Button>
        {isBoq ? (
          <Button type="button" variant="outline" className="gap-2" onClick={addGroup}>
            <Plus className="h-4 w-4" />
            Add group
          </Button>
        ) : null}
      </div>
    </section>
  )
}
