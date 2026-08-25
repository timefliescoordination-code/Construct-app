"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { ProjectOption } from "@/components/finance/add-expense-menu"

interface ProjectPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ProjectOption[]
  /** Defaults to project expense add flow. */
  hrefForProject?: (projectId: string) => string
  title?: string
}

export function ProjectPickerDialog({
  open,
  onOpenChange,
  projects,
  hrefForProject,
  title = "Select project",
}: ProjectPickerDialogProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [projects, query])

  const selectProject = (id: string) => {
    onOpenChange(false)
    setQuery("")
    router.push(hrefForProject?.(id) ?? `/projects/${id}?tab=expenses&add=1`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="max-h-64 overflow-y-auto space-y-1 pt-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No projects found.
            </p>
          ) : (
            filtered.map((project) => (
              <Button
                key={project.id}
                variant="ghost"
                className="w-full justify-start font-normal"
                onClick={() => selectProject(project.id)}
              >
                {project.name}
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
