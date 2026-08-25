import { formatRelativeTimeAgo } from "@/lib/project-timeline"
import type { ProjectIdleStatus } from "@/lib/project-idle"
import type { ProjectHealthStatus } from "@/lib/dashboard-financials"
import type { ProjectStatus } from "@/lib/types/database"

export type MonthlyCashPoint = {
  month: string
  received: number
  spent: number
  net: number
}

export type DailyCashPoint = {
  date: string
  received: number
  spent: number
}

export type ProfitViewProject = {
  id: string
  name: string
  planned_profit: number
  completed_stage_profit_loss: number
  completed_stage_target: number
  budget_usage_percent: number
  health: ProjectHealthStatus
  idle: ProjectIdleStatus
  status: ProjectStatus
  last_payment_date: string | null
  monthly_cash_series: MonthlyCashPoint[]
  cash_by_date: DailyCashPoint[]
}

export type PresentationHealth = "at_risk" | "watch" | "on_track"

export type DashboardPeriod = "7d" | "30d" | "90d" | "1y"
export type TrendRange = "6m" | "12m" | "ytd"

export function monthKeyFromDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const slice = iso.trim().slice(0, 7)
  return /^\d{4}-\d{2}$/.test(slice) ? slice : null
}

export function dayKeyFromDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const slice = iso.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null
}

export function sumCompletedStageTarget(
  milestones: { status: string; actualCompletionPercent: number; targetBudget: number }[],
): number {
  return milestones
    .filter(
      (ms) => ms.status === "completed" || ms.actualCompletionPercent === 100,
    )
    .reduce((sum, ms) => sum + ms.targetBudget, 0)
}

export function isUnderperformingProject(project: ProfitViewProject): boolean {
  return (
    project.health === "over_budget" ||
    project.health === "stage_loss" ||
    project.health === "cash_risk" ||
    project.completed_stage_profit_loss < 0
  )
}

export function projectProfitAtRisk(project: ProfitViewProject): number {
  if (!isUnderperformingProject(project)) return 0
  return Math.max(0, project.planned_profit - project.completed_stage_profit_loss)
}

export function sumProfitAtRisk(projects: ProfitViewProject[]): number {
  return projects.reduce((sum, project) => sum + projectProfitAtRisk(project), 0)
}

export function actualStageMarginPercent(
  stageProfitLoss: number,
  completedStageTarget: number,
): number | null {
  if (completedStageTarget <= 0) return null
  return Math.round((stageProfitLoss / completedStageTarget) * 1000) / 10
}

export function presentationHealth(project: ProfitViewProject): PresentationHealth {
  if (
    project.health === "over_budget" ||
    project.health === "stage_loss" ||
    project.health === "cash_risk"
  ) {
    return "at_risk"
  }
  if (project.health === "collection_risk") return "watch"
  if (
    project.health === "on_track" &&
    (project.idle.band === "slow" ||
      project.idle.band === "idle" ||
      project.idle.band === "critical")
  ) {
    return "watch"
  }
  return "on_track"
}

export const PRESENTATION_HEALTH_LABELS: Record<PresentationHealth, string> = {
  at_risk: "At Risk",
  watch: "Watch",
  on_track: "On Track",
}

function attentionRank(project: ProfitViewProject): number {
  if (project.completed_stage_profit_loss < 0) return 0
  if (project.health === "over_budget" || project.health === "stage_loss") return 1
  if (project.health === "cash_risk") return 2
  if (project.health === "collection_risk") return 3
  if (project.idle.band === "critical") return 4
  return 99
}

export function getAttentionProjects<T extends ProfitViewProject>(
  projects: T[],
  limit = 3,
): T[] {
  return projects
    .filter((project) => attentionRank(project) < 99)
    .sort((a, b) => {
      const rank = attentionRank(a) - attentionRank(b)
      if (rank !== 0) return rank
      return a.completed_stage_profit_loss - b.completed_stage_profit_loss
    })
    .slice(0, limit)
}

export function countSiteDelays(projects: ProfitViewProject[]): number {
  return projects.filter(
    (project) =>
      project.status === "active" &&
      (project.idle.band === "idle" || project.idle.band === "critical"),
  ).length
}

export function mergeMonthlyCashSeries(
  projects: Pick<ProfitViewProject, "monthly_cash_series">[],
): MonthlyCashPoint[] {
  const map = new Map<string, { received: number; spent: number }>()
  for (const project of projects) {
    for (const point of project.monthly_cash_series ?? []) {
      const current = map.get(point.month) ?? { received: 0, spent: 0 }
      current.received += point.received
      current.spent += point.spent
      map.set(point.month, current)
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      received: value.received,
      spent: value.spent,
      net: value.received - value.spent,
    }))
}

export function mergeDailyCash(
  projects: Pick<ProfitViewProject, "cash_by_date">[],
): DailyCashPoint[] {
  const map = new Map<string, { received: number; spent: number }>()
  for (const project of projects) {
    for (const point of project.cash_by_date ?? []) {
      const current = map.get(point.date) ?? { received: 0, spent: 0 }
      current.received += point.received
      current.spent += point.spent
      map.set(point.date, current)
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      received: value.received,
      spent: value.spent,
    }))
}

export function buildMonthlyCashSeries(
  expenses: { amount: number; expense_date: string }[],
  receivedPayments: { amount: number; received_date?: string | null }[],
): MonthlyCashPoint[] {
  const map = new Map<string, { received: number; spent: number }>()
  for (const expense of expenses) {
    const month = monthKeyFromDate(expense.expense_date)
    if (!month) continue
    const current = map.get(month) ?? { received: 0, spent: 0 }
    current.spent += Number(expense.amount) || 0
    map.set(month, current)
  }
  for (const payment of receivedPayments) {
    const month = monthKeyFromDate(payment.received_date ?? undefined)
    if (!month) continue
    const current = map.get(month) ?? { received: 0, spent: 0 }
    current.received += Number(payment.amount) || 0
    map.set(month, current)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      received: value.received,
      spent: value.spent,
      net: value.received - value.spent,
    }))
}

export function buildDailyCash(
  expenses: { amount: number; expense_date: string }[],
  receivedPayments: { amount: number; received_date?: string | null }[],
): DailyCashPoint[] {
  const map = new Map<string, { received: number; spent: number }>()
  for (const expense of expenses) {
    const date = dayKeyFromDate(expense.expense_date)
    if (!date) continue
    const current = map.get(date) ?? { received: 0, spent: 0 }
    current.spent += Number(expense.amount) || 0
    map.set(date, current)
  }
  for (const payment of receivedPayments) {
    const date = dayKeyFromDate(payment.received_date ?? undefined)
    if (!date) continue
    const current = map.get(date) ?? { received: 0, spent: 0 }
    current.received += Number(payment.amount) || 0
    map.set(date, current)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      received: value.received,
      spent: value.spent,
    }))
}

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function cashNetInRange(
  movements: DailyCashPoint[],
  fromInclusive: Date,
  toExclusive: Date,
): number {
  const from = localDayKey(startOfDay(fromInclusive))
  const to = localDayKey(startOfDay(toExclusive))
  return movements.reduce((sum, point) => {
    if (point.date >= from && point.date < to) {
      return sum + point.received - point.spent
    }
    return sum
  }, 0)
}

export function cashVsPriorPeriodPercent(
  movements: DailyCashPoint[],
  period: DashboardPeriod,
  now = new Date(),
): number | null {
  const days = PERIOD_DAYS[period]
  const end = startOfDay(now)
  const currentStart = new Date(end)
  currentStart.setDate(currentStart.getDate() - days)
  const priorStart = new Date(currentStart)
  priorStart.setDate(priorStart.getDate() - days)

  const currentNet = cashNetInRange(movements, currentStart, end)
  const priorNet = cashNetInRange(movements, priorStart, currentStart)
  if (priorNet === 0) return currentNet === 0 ? 0 : null
  return Math.round(((currentNet - priorNet) / Math.abs(priorNet)) * 1000) / 10
}

export function filterMonthlySeries(
  series: MonthlyCashPoint[],
  range: TrendRange,
  now = new Date(),
): MonthlyCashPoint[] {
  const year = now.getFullYear()
  const month = now.getMonth()
  if (range === "ytd") {
    const start = `${year}-01`
    return series.filter((point) => point.month >= start && point.month <= `${year}-12`)
  }
  const months = range === "6m" ? 6 : 12
  const points: MonthlyCashPoint[] = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(year, month - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const found = series.find((point) => point.month === key)
    points.push(
      found ?? { month: key, received: 0, spent: 0, net: 0 },
    )
  }
  return points
}

export function latestPaymentDate(
  projects: Pick<ProfitViewProject, "last_payment_date">[],
): string | null {
  let latest: string | null = null
  for (const project of projects) {
    if (!project.last_payment_date) continue
    if (!latest || project.last_payment_date > latest) {
      latest = project.last_payment_date
    }
  }
  return latest
}

export function formatLastPaymentLabel(iso: string | null): string {
  if (!iso) return "No client payments recorded"
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "No client payments recorded"
  return `Last client payment: ${formatRelativeTimeAgo(date)}`
}

export function projectStageMarginPercent(project: ProfitViewProject): number | null {
  return actualStageMarginPercent(
    project.completed_stage_profit_loss,
    project.completed_stage_target,
  )
}

export function healthTone(health: ProjectHealthStatus | PresentationHealth): string {
  if (health === "at_risk" || health === "over_budget" || health === "cash_risk") {
    return "text-destructive"
  }
  if (
    health === "watch" ||
    health === "collection_risk" ||
    health === "stage_loss"
  ) {
    return "text-amber-700 dark:text-amber-400"
  }
  return "text-success"
}
