"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Image as ImageIcon, Loader2, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import type { ProjectSitePhoto } from "@/lib/types/database"
import { formatStageLabel } from "@/lib/site-photos/stage-label"
import { SITE_PHOTO_UPLOAD_CONFIG } from "@/lib/site-photos/constants"
import {
  deleteSitePhotosAction,
  updateSitePhotosAction,
} from "@/lib/site-photos/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

const KEEP_STAGE = "__keep__"
const GENERAL_STAGE = "__general__"

interface SitePhotosGalleryProps {
  projectId: string
  emptyMessage?: string
  customerMode?: boolean
  canManage?: boolean
  milestones?: Array<{ id: string; name: string }>
  refreshKey?: number
}

function resolvePhotoStageLabel(photo: ProjectSitePhoto): string {
  if (photo.stage_label?.trim()) return photo.stage_label.trim()
  if (photo.milestone?.name?.trim()) return formatStageLabel(photo.milestone.name)
  return "General site photos"
}

export function SitePhotosGallery({
  projectId,
  emptyMessage = "Site photos will appear here as your project progresses.",
  customerMode = false,
  canManage = false,
  milestones = [],
  refreshKey = 0,
}: SitePhotosGalleryProps) {
  const [photos, setPhotos] = useState<ProjectSitePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [caption, setCaption] = useState("")
  const [stageValue, setStageValue] = useState(KEEP_STAGE)

  const manage = canManage && !customerMode

  const loadPhotos = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/site-photos`, {
        credentials: "include",
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load photos")
      setPhotos(json.data ?? [])
    } catch {
      setPhotos([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadPhotos()
  }, [loadPhotos, refreshKey])

  useEffect(() => {
    setSelectedIds((previous) => {
      const valid = new Set(photos.map((photo) => photo.id))
      const next = new Set([...previous].filter((id) => valid.has(id)))
      return next.size === previous.size ? previous : next
    })
  }, [photos])

  const groupedPhotos = useMemo(() => {
    const groups = new Map<string, ProjectSitePhoto[]>()
    for (const photo of photos) {
      const label = resolvePhotoStageLabel(photo)
      const list = groups.get(label) ?? []
      list.push(photo)
      groups.set(label, list)
    }
    return [...groups.entries()]
  }, [photos])

  const selectedCount = selectedIds.size
  const allSelected = photos.length > 0 && photos.every((photo) => selectedIds.has(photo.id))

  const togglePhoto = (photoId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(photos.map((photo) => photo.id)) : new Set())
  }

  const openEdit = () => {
    const selected = photos.filter((photo) => selectedIds.has(photo.id))
    if (selected.length === 0) return
    if (selected.length === 1) {
      const photo = selected[0]
      setCaption(photo.caption ?? "")
      setStageValue(photo.milestone_id ?? GENERAL_STAGE)
    } else {
      setCaption("")
      setStageValue(KEEP_STAGE)
    }
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (ids.length > SITE_PHOTO_UPLOAD_CONFIG.maxManageBatch) {
      toast.error(`Edit up to ${SITE_PHOTO_UPLOAD_CONFIG.maxManageBatch} photos at a time.`)
      return
    }

    const payload: {
      projectId: string
      photoIds: string[]
      caption?: string | null
      milestoneId?: string | null
    } = { projectId, photoIds: ids }

    if (ids.length === 1) {
      payload.caption = caption
    }

    if (ids.length === 1) {
      payload.milestoneId = stageValue === GENERAL_STAGE ? null : stageValue
    } else if (stageValue !== KEEP_STAGE) {
      payload.milestoneId = stageValue === GENERAL_STAGE ? null : stageValue
    }

    if (payload.caption === undefined && payload.milestoneId === undefined) {
      toast.error("Choose a stage to apply, or edit one photo to change its caption.")
      return
    }

    setIsSaving(true)
    const result = await updateSitePhotosAction(payload)
    setIsSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Updated ${result.data.updated} photo${result.data.updated === 1 ? "" : "s"}.`)
    setEditOpen(false)
    setSelectedIds(new Set())
    await loadPhotos()
  }

  const handleDelete = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (ids.length > SITE_PHOTO_UPLOAD_CONFIG.maxManageBatch) {
      toast.error(`Delete up to ${SITE_PHOTO_UPLOAD_CONFIG.maxManageBatch} photos at a time.`)
      return
    }
    setIsSaving(true)
    const result = await deleteSitePhotosAction({ projectId, photoIds: ids })
    setIsSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Deleted ${result.data.deleted} photo${result.data.deleted === 1 ? "" : "s"}.`)
    setDeleteOpen(false)
    setSelectedIds(new Set())
    await loadPhotos()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {manage ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
              onCheckedChange={(value) => toggleAll(value === true)}
              aria-label="Select all photos"
            />
            <span className="text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} selected`
                : "Select photos to delete or edit"}
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCount === 0 || isSaving}
              onClick={openEdit}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedCount === 0 || isSaving}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
            {selectedCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSaving}
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {groupedPhotos.map(([stageLabel, stagePhotos]) => (
        <section key={stageLabel} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{stageLabel}</h3>
            <span className="text-xs text-muted-foreground">
              {stagePhotos.length} photo{stagePhotos.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stagePhotos.map((photo) => {
              const imageSrc = `/api/projects/${projectId}/site-photos/${photo.id}/view`
              const uploaderName = photo.uploader?.full_name?.trim()
              const photoCaption = photo.caption?.trim()
              const selected = selectedIds.has(photo.id)

              return (
                <div
                  key={photo.id}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-lg border bg-background",
                    selected ? "border-primary ring-2 ring-primary/30" : "border-border",
                  )}
                >
                  <div
                    className={cn("relative aspect-square bg-muted", manage && "cursor-pointer")}
                    onClick={manage ? () => togglePhoto(photo.id) : undefined}
                    onKeyDown={
                      manage
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              togglePhoto(photo.id)
                            }
                          }
                        : undefined
                    }
                    role={manage ? "button" : undefined}
                    tabIndex={manage ? 0 : undefined}
                    aria-pressed={manage ? selected : undefined}
                    aria-label={manage ? `Select photo ${photoCaption || photo.file_name}` : undefined}
                  >
                    <img
                      src={imageSrc}
                      alt={photoCaption || photo.file_name}
                      className={cn("h-full w-full object-cover", customerMode && "select-none")}
                      draggable={!customerMode}
                      onContextMenu={customerMode ? (event) => event.preventDefault() : undefined}
                    />
                    {manage ? (
                      <div
                        className="absolute left-2 top-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => togglePhoto(photo.id)}
                          aria-label={`Select ${photoCaption || photo.file_name}`}
                          className="border-background bg-background/90 shadow-sm"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-0.5 p-2">
                    {photoCaption ? (
                      <p className="line-clamp-2 text-xs font-medium">{photoCaption}</p>
                    ) : null}
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(photo.created_at), "dd MMM yyyy")}
                      {uploaderName ? ` · ${uploaderName}` : ""}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCount === 1 ? "Edit photo" : `Edit ${selectedCount} photos`}
            </DialogTitle>
            <DialogDescription>
              {selectedCount === 1
                ? "Update the caption and construction stage."
                : "Apply a construction stage to the selected photos."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCount === 1 ? (
              <div className="space-y-2">
                <Label htmlFor="site-photo-caption">Caption</Label>
                <Input
                  id="site-photo-caption"
                  value={caption}
                  maxLength={SITE_PHOTO_UPLOAD_CONFIG.maxCaptionLength}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="What this photo shows"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Construction stage</Label>
              <Select value={stageValue} onValueChange={setStageValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a stage" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCount > 1 ? (
                    <SelectItem value={KEEP_STAGE}>Keep current stages</SelectItem>
                  ) : null}
                  <SelectItem value={GENERAL_STAGE}>General site photos</SelectItem>
                  {milestones.map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id}>
                      {formatStageLabel(milestone.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void handleEditSave()}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} photo{selectedCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the photo{selectedCount === 1 ? "" : "s"} from the project. Customers will
              no longer see {selectedCount === 1 ? "it" : "them"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
