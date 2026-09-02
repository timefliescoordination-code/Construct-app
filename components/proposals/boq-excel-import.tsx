'use client'

import { useRef, useState } from 'react'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  buildBoqTemplateWorkbook,
  mergeImportedBoqItems,
  parseBoqWorkbookData,
} from '@/lib/proposals/boq-excel'
import { MAX_BOQ_IMPORT_BYTES } from '@/lib/proposals/constants'
import type { ProposalItemDraft } from '@/lib/proposals/types'
import { cn } from '@/lib/utils'

type BoqExcelImportProps = {
  items: ProposalItemDraft[]
  onChange: (items: ProposalItemDraft[]) => void
}

function downloadTemplate() {
  const bytes = buildBoqTemplateWorkbook()
  const blob = new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'vra-boq-template.xlsx'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function BoqExcelImport({ items, onChange }: BoqExcelImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const importFile = async (file: File | null) => {
    if (!file) return
    if (file.size > MAX_BOQ_IMPORT_BYTES) {
      toast.error('That file is too large. Use a spreadsheet under 8 MB.')
      return
    }

    const existingBoq = items.some((item) => item.section === 'boq' && item.description.trim())
    if (existingBoq) {
      const confirmed = window.confirm(
        'This will replace the current BOQ items with rows from the spreadsheet. Continue?',
      )
      if (!confirmed) {
        if (inputRef.current) inputRef.current.value = ''
        return
      }
    }

    setBusy(true)
    try {
      const name = file.name.toLowerCase()
      const result = name.endsWith('.csv')
        ? parseBoqWorkbookData(await file.text())
        : parseBoqWorkbookData(await file.arrayBuffer())

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      onChange(mergeImportedBoqItems(items, result.items))
      setFileName(file.name)

      const extras: string[] = []
      if (result.truncated) extras.push('only the first 500 rows were imported')
      if (result.skipped > 0) extras.push(`${result.skipped} row(s) skipped`)
      toast.success(
        extras.length > 0
          ? `Imported ${result.items.length} BOQ item(s). ${extras.join('; ')}.`
          : `Imported ${result.items.length} BOQ item(s) from ${file.name}.`,
      )
    } catch {
      toast.error('Could not read that file. Use .xlsx, .xls, or .csv.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="sr-only"
        onChange={(event) => void importFile(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          void importFile(event.dataTransfer.files?.[0] ?? null)
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          busy ? 'pointer-events-none opacity-70' : 'cursor-pointer',
        )}
      >
        {busy ? (
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        )}
        {fileName ? (
          <p className="text-sm font-medium">{fileName}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Click to upload a BOQ Excel file, or drag and drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              .xlsx, .xls, or .csv · Groups, Description, Nos/L/B/H, Qty, Unit, Rate
            </p>
          </>
        )}
      </button>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={downloadTemplate}>
          <FileSpreadsheet className="h-4 w-4" />
          Download template
        </Button>
      </div>
    </div>
  )
}
