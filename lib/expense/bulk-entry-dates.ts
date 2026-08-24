function padDatePart(value: number) {
  return String(value).padStart(2, "0")
}

function isValidYmd(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function formatYmd(year: number, month: number, day: number) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`
}

/** Convert CSV/Excel dates (dd/mm/yyyy, etc.) to yyyy-MM-dd for <input type="date">. */
export function toDateInputValue(raw: string, fallback = ""): string {
  const value = raw.trim().replace(/["']/g, "")
  if (!value) return fallback

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return isValidYmd(year, month, day) ? value : fallback
  }

  const iso = value.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (isValidYmd(year, month, day)) return formatYmd(year, month, day)
  }

  const dotted = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (dotted) {
    let day = Number(dotted[1])
    let month = Number(dotted[2])
    let year = Number(dotted[3])
    if (year < 100) year += year >= 70 ? 1900 : 2000
    if (month > 12 && day <= 12) {
      const swap = day
      day = month
      month = swap
    }
    if (isValidYmd(year, month, day)) return formatYmd(year, month, day)
  }

  const serial = Number(value)
  if (Number.isInteger(serial) && serial > 20000 && serial < 80000) {
    const utc = Date.UTC(1899, 11, 30) + serial * 86400000
    const date = new Date(utc)
    return formatYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }

  return fallback
}
