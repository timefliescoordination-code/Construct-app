'use client'

import { useRef, useState } from 'react'
import { Camera, ChevronDown, Loader2 } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { QualityInspectionDetail, QualityItemStatus } from '@/lib/types/database'
import {
  saveInspectionItemAction,
  saveInspectionParameterAction,
  uploadInspectionPhotoAction,
} from '@/lib/quality/actions'
import { ItemStatusControls } from '@/components/quality/item-status-controls'
import { ParameterFields } from '@/components/quality/parameter-fields'
import { FailurePanel } from '@/components/quality/failure-panel'
import { ItemStatusBadge } from '@/components/quality/inspection-status-badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function InspectionChecklist({
  inspection,
  staff,
  canEdit,
  onChanged,
}: {
  inspection: QualityInspectionDetail
  staff: Array<{ id: string; full_name: string }>
  canEdit: boolean
  onChanged: () => void
}) {
  const [savingId, setSavingId] = useState<string | null>(null)

  const setItemStatus = async (itemId: string, status: QualityItemStatus) => {
    setSavingId(itemId)
    const result = await saveInspectionItemAction({
      inspectionId: inspection.id,
      itemId,
      status,
    })
    setSavingId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    onChanged()
  }

  const saveParameter = async (parameterId: string, actualValue: string) => {
    const result = await saveInspectionParameterAction({
      inspectionId: inspection.id,
      parameterId,
      actualValue,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    onChanged()
  }

  return (
    <Accordion type="multiple" className="space-y-2">
      {inspection.items.map((item, index) => {
        const openAction =
          item.corrective_actions.find((row) => row.status !== 'closed') ??
          item.corrective_actions[0] ??
          null
        return (
          <AccordionItem
            key={item.id}
            value={item.id}
            className={cn(
              'rounded-xl border px-3 last:border-b',
              item.status === 'fail' && 'border-destructive/40 bg-destructive/5',
              item.status === 'pass' && 'border-green-500/30 bg-green-500/5',
              item.is_critical && item.status === 'fail' && 'ring-1 ring-destructive/40',
            )}
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold text-muted-foreground">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium leading-snug">{item.title}</span>
                    {item.is_critical ? (
                      <Badge variant="destructive" className="text-[10px]">
                        CRITICAL
                      </Badge>
                    ) : null}
                    {savingId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <ItemStatusBadge status={item.status} />
                    )}
                  </div>
                </div>
                <ChevronDown className="hidden" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              {item.description ? (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              ) : null}
              <ItemStatusControls
                value={item.status}
                allowNa={item.allow_na}
                disabled={!canEdit}
                onChange={(status) => void setItemStatus(item.id, status)}
              />
              {item.parameters.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Technical verification
                  </p>
                  {item.parameters.map((parameter) => (
                    <ParameterFields
                      key={parameter.id}
                      parameter={parameter}
                      disabled={!canEdit}
                      onSave={(value) => void saveParameter(parameter.id, value)}
                    />
                  ))}
                </div>
              ) : null}
              {item.status === 'fail' ? (
                <FailurePanel
                  inspectionId={inspection.id}
                  itemId={item.id}
                  action={openAction}
                  photos={item.photos.filter((photo) => photo.level === 'failure' || photo.inspection_item_id === item.id)}
                  staff={staff}
                  disabled={!canEdit}
                  onChanged={onChanged}
                />
              ) : (
                <ItemPhotoButton
                  inspectionId={inspection.id}
                  itemId={item.id}
                  disabled={!canEdit}
                  onChanged={onChanged}
                />
              )}
              {item.photos.length > 0 && item.status !== 'fail' ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {item.photos.map((photo) => (
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
                        className="h-20 w-full rounded-md object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

function ItemPhotoButton({
  inspectionId,
  itemId,
  disabled,
  onChanged,
}: {
  inspectionId: string
  itemId: string
  disabled?: boolean
  onChanged: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          setUploading(true)
          const formData = new FormData()
          formData.set('inspectionId', inspectionId)
          formData.set('itemId', itemId)
          formData.set('level', 'item')
          formData.set('file', file)
          const result = await uploadInspectionPhotoAction(formData)
          setUploading(false)
          if (!result.ok) toast.error(result.error)
          else {
            toast.success('Photo attached.')
            onChanged()
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        Add photo
      </Button>
    </>
  )
}
