import { DAY_LABELS } from "@/lib/manpower/constants"

export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function formatDisplayDate(date: Date): string {
  const day = date.getDate()
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const year = String(date.getFullYear()).slice(2)
  return `${day}-${months[date.getMonth()]}-${year}`
}

export function weekDayDates(startDate: string): { iso: string; label: string; day: string }[] {
  const start = new Date(`${startDate}T00:00:00`)
  return DAY_LABELS.map((day, index) => {
    const current = addDays(start, index)
    return {
      iso: toIsoDate(current),
      label: formatDisplayDate(current),
      day,
    }
  })
}

export function nextWeekStartDate(
  anchorDate: string | null | undefined,
  existingStarts: string[],
): string {
  if (existingStarts.length === 0) {
    const anchor = anchorDate ? new Date(`${anchorDate}T00:00:00`) : new Date()
    return toIsoDate(getMonday(anchor))
  }

  const latest = existingStarts
    .map((d) => new Date(`${d}T00:00:00`))
    .sort((a, b) => b.getTime() - a.getTime())[0]
  return toIsoDate(addDays(latest, 7))
}

/** Any calendar day → Monday ISO start for that work week. */
export function weekStartIsoFromPickerDate(date: Date): string {
  return toIsoDate(getMonday(date))
}

export function formatWeekRangeLabel(startDateIso: string): string {
  const days = weekDayDates(startDateIso)
  if (days.length === 0) return startDateIso
  if (days.length === 1) return days[0].label
  return `${days[0].label} – ${days[days.length - 1].label}`
}
