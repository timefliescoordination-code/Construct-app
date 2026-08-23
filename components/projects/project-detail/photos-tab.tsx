"use client"

import { useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Image as ImageIcon, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { uploadSitePhotosAction } from "@/lib/site-photos/actions"
import { SitePhotosGallery } from "./site-photos-gallery"

interface PhotosTabProps {
  projectId?: string
  projectName?: string
  canUpload?: boolean
}

export function PhotosTab({
  projectId: propProjectId,
  projectName: propProjectName,
  canUpload = false,
}: PhotosTabProps = {}) {
  const params = useParams()
  const projectId = propProjectId || (params?.id as string)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (fileList: FileList | null) => {
    if (!projectId || !fileList?.length) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.set("projectId", projectId)
      for (const file of Array.from(fileList)) {
        formData.append("files", file)
      }

      const result = await uploadSitePhotosAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(`${result.data?.count ?? 0} site photo(s) uploaded`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      window.location.reload()
    } finally {
      setIsUploading(false)
    }
  }

  if (!projectId) {
    return null
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Site Photos
            {propProjectName && (
              <span className="text-sm font-normal text-muted-foreground">
                — {propProjectName}
              </span>
            )}
          </CardTitle>
          {canUpload && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload photos
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <SitePhotosGallery
            projectId={projectId}
            emptyMessage={
              canUpload
                ? "No site photos yet. Upload images to share progress with your customer."
                : "Site photos will appear here as the project progresses."
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
