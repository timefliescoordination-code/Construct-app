export type MoneyTimelineType = "received" | "expense"

export type MoneyTimelineEntry = {
  id: string
  date: string
  /** Last day when expense range spans multiple dates */
  endDate?: string
  /** Display label e.g. "18 to 21 Nov" */
  dateLabel?: string
  type: MoneyTimelineType
  description: string
  projectId: string
  projectName: string
  amount: number
  /** Present on grouped expense rows */
  summary?: string
  items?: MoneyTimelineExpenseItem[]
}

export type MoneyTimelineExpenseItem = {
  id: string
  description: string
  amount: number
  date?: string
}

export type MoneyTimelineFilters = {
  dateFrom?: string
  dateTo?: string
  projectId?: string
  type?: MoneyTimelineType | "all"
}

export type MoneyTimelineResponse = {
  rows: MoneyTimelineEntry[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  filterOptions: {
    projects: { id: string; name: string }[]
  }
}

export type RawExpenseRow = {
  id: string
  projectId: string
  projectName: string
  description: string
  amount: number
  date: string
}

export type RawReceivedRow = {
  id: string
  projectId: string
  projectName: string
  amount: number
  date: string
}
