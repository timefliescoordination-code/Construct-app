import { eachDayOfInterval, format, isValid, parseISO } from "date-fns"

/** Normalize DB date/timestamp values to yyyy-MM-dd. */
export function normalizeDateValue(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const datePart = trimmed.slice(0, 10)
  const parsed = parseISO(datePart)
  if (!isValid(parsed)) return null
  return datePart
}

export function safeFormatDate(date: string, pattern: string): string {
  const parsed = parseISO(date)
  if (!isValid(parsed)) return date
  return format(parsed, pattern)
}

export function formatExpenseDateRange(start: string, end: string): string {
  if (start === end) {
    return safeFormatDate(start, "dd-MMM-yyyy")
  }

  const startDate = parseISO(start)
  const endDate = parseISO(end)
  if (!isValid(startDate) || !isValid(endDate)) {
    return `${start} to ${end}`
  }

  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth()
  const sameYear = startDate.getFullYear() === endDate.getFullYear()

  if (sameMonth) {
    return `${format(startDate, "d")} to ${format(endDate, "d MMM")}`
  }
  if (sameYear) {
    return `${format(startDate, "d MMM")} to ${format(endDate, "d MMM")}`
  }
  return `${format(startDate, "d MMM yyyy")} to ${format(endDate, "d MMM yyyy")}`
}

export function rangeHasOtherProject(
  start: string,
  end: string,
  projectId: string,
  dateProjects: Map<string, Set<string>>,
): boolean {
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  if (!isValid(startDate) || !isValid(endDate)) return true

  const days = eachDayOfInterval({ start: startDate, end: endDate })
  for (const day of days) {
    const key = format(day, "yyyy-MM-dd")
    const projects = dateProjects.get(key)
    if (!projects) continue
    for (const id of projects) {
      if (id !== projectId) return true
    }
  }
  return false
}

export function unwrapProject(
  project: unknown,
): { id: string; name: string } | null {
  if (!project) return null
  if (Array.isArray(project)) {
    const first = project[0]
    if (!first || typeof first !== "object") return null
    return first as { id: string; name: string }
  }
  if (typeof project === "object") {
    return project as { id: string; name: string }
  }
  return null
}
