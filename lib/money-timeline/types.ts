export type MoneyTimelineType = "received" | "expense"

export type MoneyTimelineExpenseItem = {
  id: string
  description: string
  amount: number
}

export type MoneyTimelineEntry = {
  id: string
  date: string
  type: MoneyTimelineType
  description: string
  projectId: string
  projectName: string
  amount: number
  /** Present on grouped expense rows */
  summary?: string
  items?: MoneyTimelineExpenseItem[]
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
