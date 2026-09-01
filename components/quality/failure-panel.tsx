'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  QUALITY_CORRECTIVE_STATUS_LABELS,
  type QualityCorrectiveStatus,
} from '@/lib/quality/constants'
import type { QualityCorrectiveAction, QualityInspectionPhoto } from '@/lib/types/database'
import { saveCorrectiveActionAction, uploadInspectionPhotoAction } from '@/lib/quality/actions'
import { toast } from 'sonner'

export function FailurePanel({
  inspectionId,
  itemId,
  action,
  photos,
  staff,
  disabled,
  onChanged,
}: {
  inspectionId: string
  itemId: string
  action: QualityCorrectiveAction | null
  photos: QualityInspectionPhoto[]
  staff: Array<{ id: string; full_name: string }>
  disabled?: boolean
  onChanged: () => void
}) {
  const [remark, setRemark] = useState(action?.remark ?? '')
  const [correctiveAction, setCorrectiveAction] = useState(action?.corrective_action ?? '')
  const [responsiblePersonId, setResponsiblePersonId] = useState(
    action?.responsible_person_id ?? '',
  )
  const [targetDate, setTargetDate] = useState(action?.target_date ?? '')
  const [status, setStatus] = useState<QualityCorrectiveStatus>(action?.status ?? 'open')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    if (!remark.trim()) {
      toast.error('Add a failure remark.')
      return
    }
    setSaving(true)
    const result = await saveCorrectiveActionAction({
      inspectionId,
      itemId,
      remark,
      correctiveAction,
      responsiblePersonId: responsiblePersonId || null,
      targetDate: targetDate || null,
      status,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success('Corrective action saved.')
    onChanged()
  }

  const upload = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.set('inspectionId', inspectionId)
    formData.set('itemId', itemId)
    if (action?.id) formData.set('correctiveActionId', action.id)
    formData.set('level', 'failure')
    formData.set('file', file)
    const result = await uploadInspectionPhotoAction(formData)
    setUploading(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success('Photo attached.')
    onChanged()
  }

  return (
    <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm font-semibold text-destructive">Failure details</p>
      <div className="space-y-1">
        <Label htmlFor={`remark-${itemId}`}>Remark</Label>
        <Textarea
          id={`remark-${itemId}`}
          value={remark}
          disabled={disabled}
          onChange={(event) => setRemark(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`action-${itemId}`}>Corrective action</Label>
        <Textarea
          id={`action-${itemId}`}
          value={correctiveAction}
          disabled={disabled}
          onChange={(event) => setCorrectiveAction(event.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Responsible person</Label>
          <Select
            value={responsiblePersonId}
            onValueChange={setResponsiblePersonId}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`date-${itemId}`}>Target date</Label>
          <Input
            id={`date-${itemId}`}
            type="date"
            value={targetDate}
            disabled={disabled}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as QualityCorrectiveStatus)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(QUALITY_CORRECTIVE_STATUS_LABELS) as QualityCorrectiveStatus[]).map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {QUALITY_CORRECTIVE_STATUS_LABELS[value]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => void upload(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Take / upload photo
        </Button>
        <Button type="button" size="sm" disabled={disabled || saving} onClick={() => void save()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save failure details
        </Button>
      </div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={`/api/quality/inspections/${inspectionId}/photos/${photo.id}/view`}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-md border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/quality/inspections/${inspectionId}/photos/${photo.id}/view`}
                alt={photo.file_name}
                className="h-20 w-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
