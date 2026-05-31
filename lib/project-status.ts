import type { ProjectStatus as DbProjectStatus } from "@/lib/types/database"

export type ProjectFilterStatus = "all" | DbProjectStatus | "high-risk"

export const PROJECT_STATUS_LABELS: Record<DbProjectStatus, string> = {
  active: "Active",
  completed: "Completed",
  "on-hold": "On Hold",
  pending: "Pending",
  archived: "Archived",
}

export const PROJECT_STATUS_BADGE: Record<
  DbProjectStatus,
  { className: string; label: string }
> = {
  active: {
    className: "bg-primary/20 text-primary border-primary/30",
    label: "Active",
  },
  completed: {
    className: "bg-green-500/20 text-green-500 border-green-500/30",
    label: "Completed",
  },
  "on-hold": {
    className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
    label: "On Hold",
  },
  pending: {
    className: "bg-muted text-muted-foreground border-border",
    label: "Pending",
  },
  archived: {
    className: "bg-muted text-muted-foreground border-border line-through",
    label: "Archived",
  },
}

export function isDbProjectStatus(value: string): value is DbProjectStatus {
  return (
    value === "active" ||
    value === "completed" ||
    value === "on-hold" ||
    value === "pending" ||
    value === "archived"
  )
}

export function isArchivedProjectStatus(status: string): boolean {
  return status === "archived"
}

export function excludeArchivedProjects<T extends { status: string }>(projects: T[]): T[] {
  return projects.filter((project) => !isArchivedProjectStatus(project.status))
}

export function activeProjectIdSet(projects: Array<{ id: string; status: string }>): Set<string> {
  return new Set(excludeArchivedProjects(projects).map((project) => project.id))
}

export function filterRowsByActiveProjects<T extends { project_id: string }>(
  rows: T[],
  activeIds: Set<string>,
): T[] {
  return rows.filter((row) => activeIds.has(row.project_id))
}
