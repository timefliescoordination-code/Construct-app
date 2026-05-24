"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Image as ImageIcon, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface PhotosTabProps {
  projectId?: string
}

export function PhotosTab({ projectId: propProjectId }: PhotosTabProps = {}) {
  const params = useParams()
  const projectId = propProjectId || (params?.id as string)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProject() {
      if (!projectId) {
        setIsLoading(false)
        return
      }

      const supabase = createClient()
      const { data } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .single()

      setProjectName(data?.name ?? null)
      setIsLoading(false)
    }

    loadProject()
  }, [projectId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Site Photos
            {projectName && (
              <span className="text-sm font-normal text-muted-foreground">— {projectName}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">No photos yet</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Site photo uploads are not configured for this project yet. Photos will appear here
              once storage is connected.
            </p>
            <Button variant="outline" className="mt-6" disabled>
              Upload Photo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
