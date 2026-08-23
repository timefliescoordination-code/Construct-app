"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Image as ImageIcon, Loader2 } from "lucide-react"
import type { ProjectSitePhoto } from "@/lib/types/database"

interface SitePhotosGalleryProps {
  projectId: string
  emptyMessage?: string
  customerMode?: boolean
  refreshKey?: number
}

export function SitePhotosGallery({
  projectId,
  emptyMessage = "Site photos will appear here as your project progresses.",
  customerMode = false,
  refreshKey = 0,
}: SitePhotosGalleryProps) {
  const [photos, setPhotos] = useState<ProjectSitePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {photos.map((photo) => {
        const imageSrc = `/api/projects/${projectId}/site-photos/${photo.id}/view`
        const uploaderName = photo.uploader?.full_name?.trim()
        const caption = photo.caption?.trim()

        return (
          <div
            key={photo.id}
            className="flex flex-col overflow-hidden rounded-lg border border-border"
          >
            <div className="relative aspect-square bg-muted">
              <img
                src={imageSrc}
                alt={caption || photo.file_name}
                className={`h-full w-full object-cover ${customerMode ? "select-none" : ""}`}
                draggable={!customerMode}
                onContextMenu={customerMode ? (e) => e.preventDefault() : undefined}
              />
            </div>
            <div className="p-2 space-y-0.5">
              {caption ? (
                <p className="text-xs font-medium line-clamp-2">{caption}</p>
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
  )
}
