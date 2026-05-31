"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProjectFilterStatus } from "@/lib/project-status"

interface ProjectFiltersProps {
  activeFilter: ProjectFilterStatus
  onFilterChange: (filter: ProjectFilterStatus) => void
  counts: {
    all: number
    active: number
    completed: number
    "on-hold": number
    pending: number
    archived: number
    "high-risk": number
  }
  excludeFilters?: ProjectFilterStatus[]
}

export function ProjectFilters({ activeFilter, onFilterChange, counts, excludeFilters = [] }: ProjectFiltersProps) {
  const filters: { key: ProjectFilterStatus; label: string }[] = [
    { key: "all", label: "All Projects" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "on-hold", label: "On Hold" },
    { key: "pending", label: "Pending" },
    { key: "archived", label: "Archived" },
    { key: "high-risk", label: "High Risk" },
  ].filter((filter) => !excludeFilters.includes(filter.key))

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant={activeFilter === filter.key ? "default" : "secondary"}
          size="sm"
          onClick={() => onFilterChange(filter.key)}
          className={cn(
            "gap-2",
            activeFilter === filter.key
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-muted"
          )}
        >
          {filter.label}
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded-full",
              activeFilter === filter.key
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {counts[filter.key]}
          </span>
        </Button>
      ))}
    </div>
  )
}

export type { ProjectFilterStatus as ProjectStatus }
