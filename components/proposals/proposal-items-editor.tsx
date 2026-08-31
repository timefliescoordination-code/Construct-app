'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/currency'
import { linePrice, toQuantity } from '@/lib/proposals/calculations'
import { PROPOSAL_UNITS, defaultUnitForSection, type ProposalItemSection } from '@/lib/proposals/constants'
import type { ProposalItemDraft } from '@/lib/proposals/types'
import { cn } from '@/lib/utils'

type ProposalItemsEditorProps = {
  section: ProposalItemSection
  title: string
  items: ProposalItemDraft[]
  onChange: (items: ProposalItemDraft[]) => void
  emptyHint?: string
}

export function ProposalItemsEditor({
  section,
  title,
  items,
  onChange,
  emptyHint,
}: ProposalItemsEditorProps) {
  const rows = items.filter((item) => item.section === section)
  const sectionTotal = rows.reduce(
    (sum, item) => sum + linePrice(toQuantity(item.quantity), toQuantity(item.rate)),
    0,
  )

  const updateRow = (index: number, patch: Partial<ProposalItemDraft>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange(next)
  }

  const addRow = () => {
    onChange([
      ...items,
      {
        section,
        description: '',
        quantity: '',
        unit: defaultUnitForSection(section),
        rate: '',
      },
    ])
  }

  const removeRow = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    if (items[index]?.section !== section || items[target]?.section !== section) return
    const next = [...items]
    const current = next[index]
    next[index] = next[target]
    next[target] = current
    onChange(next)
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

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-muted/50 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">S.No</th>
              <th className="px-3 py-2">Description</th>
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
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No items yet.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                if (item.section !== section) return null
                const serial = items.slice(0, index + 1).filter((row) => row.section === section).length
                const price = linePrice(toQuantity(item.quantity), toQuantity(item.rate))
                return (
                  <tr key={`${section}-${index}`} className="border-t border-border">
                    <td className="px-3 py-2 align-top text-muted-foreground">{serial}</td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        value={item.description}
                        onChange={(e) => updateRow(index, { description: e.target.value })}
                        placeholder="Description"
                      />
                    </td>
                    <td className="w-28 px-3 py-2 align-top">
                      <Input
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => updateRow(index, { quantity: e.target.value })}
                        placeholder="0"
                      />
                    </td>
                    <td className="w-32 px-3 py-2 align-top">
                      <Input
                        list={`proposal-units-${section}`}
                        value={item.unit}
                        onChange={(e) => updateRow(index, { unit: e.target.value })}
                        placeholder="unit"
                      />
                    </td>
                    <td className="w-32 px-3 py-2 align-top">
                      <Input
                        inputMode="decimal"
                        value={item.rate}
                        onChange={(e) => updateRow(index, { rate: e.target.value })}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 align-top text-right font-medium tabular-nums">
                      {formatINR(price)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex justify-end gap-1">
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
      <datalist id={`proposal-units-${section}`}>
        {PROPOSAL_UNITS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
      <Button type="button" variant="outline" className={cn('gap-2')} onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add item
      </Button>
    </section>
  )
}
