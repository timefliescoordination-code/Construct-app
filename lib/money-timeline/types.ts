export type MoneyTimelineType = "received" | "expense"

export type MoneyTimelineEntry = {
  id: string
  date: string
  type: MoneyTimelineType
  description: string
  projectId: string
  projectName: string
  amount: number
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
