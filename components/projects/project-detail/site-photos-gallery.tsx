"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Image as ImageIcon, Loader2 } from "lucide-react"
import type { ProjectSitePhoto } from "@/lib/types/database"

interface SitePhotosGalleryProps {
  projectId: string
  emptyMessage?: string
}

export function SitePhotosGallery({
  projectId,
  emptyMessage = "Site photos will appear here as your project progresses.",
}: SitePhotosGalleryProps) {
  const [photos, setPhotos] = useState<ProjectSitePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [urlById, setUrlById] = useState<Record<string, string>>({})

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
  }, [loadPhotos])

  useEffect(() => {
    let cancelled = false

    async function loadUrls() {
      const entries: Record<string, string> = {}
      for (const photo of photos) {
        try {
          const res = await fetch(
            `/api/projects/${projectId}/site-photos/${photo.id}/view`,
            { credentials: "include", cache: "no-store" },
          )
          const json = await res.json()
          if (res.ok && json.data?.url) {
            entries[photo.id] = json.data.url
          }
        } catch {
          // skip failed thumbnail
        }
      }
      if (!cancelled) {
        setUrlById(entries)
      }
    }

    if (photos.length > 0) {
      void loadUrls()
    } else {
      setUrlById({})
    }

    return () => {
      cancelled = true
    }
  }, [photos, projectId])

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
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="flex flex-col overflow-hidden rounded-lg border border-border"
        >
          <div className="relative aspect-square bg-muted">
            {urlById[photo.id] ? (
              <img
                src={urlById[photo.id]}
                alt={photo.file_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="p-2">
            <p className="text-xs font-medium truncate">{photo.file_name}</p>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(photo.created_at), "dd MMM yyyy")}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
