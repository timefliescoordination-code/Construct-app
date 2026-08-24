import type {
  CompanyExpenseBulkRow,
  CompanyIncomeBulkRow,
  EngineerBulkRow,
  PersonalExpenseBulkRow,
  ProjectBulkRow,
} from "@/lib/expense/bulk-entry-types"
import { newRowId } from "@/lib/expense/bulk-entry-types"
import { emptyProjectBulkRow } from "@/lib/expense/bulk-entry-project"
import {
  applySuggestionsToProjectRows,
  type SuggestContext,
} from "@/lib/expense/suggest-from-description"
import {
  emptyCompanyExpenseRow,
  emptyCompanyIncomeRow,
  emptyPersonalExpenseRow,
} from "@/lib/expense/bulk-entry-finance"

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      cells.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_")
}

function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function exportProjectBulkRowsCsv(rows: ProjectBulkRow[], milestones: { id: string; name: string }[]) {
  const milestoneName = (id: string) => milestones.find((m) => m.id === id)?.name ?? ""
  const header =
    "date,category,subcategory,labour_team_id,milestone,description,vendor,amount"
  const body = rows.map((row) =>
    [
      row.date,
      row.category,
      row.subcategory,
      row.labourTeamId,
      milestoneName(row.milestoneId),
      row.description,
      row.vendor,
      row.amount,
    ]
      .map((v) => escapeCsv(String(v ?? "")))
      .join(","),
  )
  downloadCsv("bulk-expenses.csv", [header, ...body])
}

export function parseProjectBulkCsv(
  text: string,
  today: string,
  milestones: { id: string; name: string }[],
): ProjectBulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const milestoneIdByName = new Map(
    milestones.map((m) => [m.name.trim().toLowerCase(), m.id]),
  )

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const record: Record<string, string> = {}
    headers.forEach((h, i) => {
      record[h] = cells[i] ?? ""
    })
    const milestoneRaw = record.milestone ?? record.stage_milestone ?? ""
    const milestoneId =
      milestones.find((m) => m.id === milestoneRaw)?.id ??
      milestoneIdByName.get(milestoneRaw.trim().toLowerCase()) ??
      ""

    return {
      ...emptyProjectBulkRow(record.date || today),
      id: newRowId(),
      date: record.date || today,
      category: record.category ?? "",
      subcategory: record.subcategory ?? "",
      labourTeamId: record.labour_team_id ?? record.labour_team ?? "",
      milestoneId,
      description: record.description ?? "",
      vendor: record.vendor ?? "",
      amount: record.amount ?? "",
    }
  })
}

/** Parse a project bulk CSV, then fill empty category/subcategory/milestone from descriptions. */
export function parseProjectBulkCsvWithSuggestions(
  text: string,
  today: string,
  milestones: { id: string; name: string }[],
  suggest: SuggestContext,
) {
  return applySuggestionsToProjectRows(parseProjectBulkCsv(text, today, milestones), suggest)
}

export function exportFinanceExpenseCsv(rows: CompanyExpenseBulkRow[]) {
  const header = "date,category,description,vendor,amount"
  const body = rows.map((row) =>
    [row.date, row.category, row.description, row.vendor, row.amount]
      .map((v) => escapeCsv(String(v ?? "")))
      .join(","),
  )
  downloadCsv("bulk-company-expenses.csv", [header, ...body])
}

export function parseFinanceExpenseCsv(text: string, today: string): CompanyExpenseBulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const record: Record<string, string> = {}
    headers.forEach((h, i) => {
      record[h] = cells[i] ?? ""
    })
    return {
      ...emptyCompanyExpenseRow(record.date || today, record.category ?? ""),
      id: newRowId(),
      date: record.date || today,
      category: record.category ?? "",
      description: record.description ?? "",
      vendor: record.vendor ?? "",
      amount: record.amount ?? "",
    }
  })
}

export function exportFinanceIncomeCsv(rows: CompanyIncomeBulkRow[]) {
  const header = "date,category,description,source,amount"
  const body = rows.map((row) =>
    [row.date, row.category, row.description, row.source, row.amount]
      .map((v) => escapeCsv(String(v ?? "")))
      .join(","),
  )
  downloadCsv("bulk-company-income.csv", [header, ...body])
}

export function parseFinanceIncomeCsv(text: string, today: string): CompanyIncomeBulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const record: Record<string, string> = {}
    headers.forEach((h, i) => {
      record[h] = cells[i] ?? ""
    })
    return {
      ...emptyCompanyIncomeRow(record.date || today, record.category ?? ""),
      id: newRowId(),
      date: record.date || today,
      category: record.category ?? "",
      description: record.description ?? "",
      source: record.source ?? record.source_name ?? "",
      amount: record.amount ?? "",
    }
  })
}

export function exportPersonalExpenseCsv(rows: PersonalExpenseBulkRow[]) {
  const header = "date,category,description,amount"
  const body = rows.map((row) =>
    [row.date, row.category, row.description, row.amount]
      .map((v) => escapeCsv(String(v ?? "")))
      .join(","),
  )
  downloadCsv("bulk-personal-expenses.csv", [header, ...body])
}

export function parsePersonalExpenseCsv(text: string, today: string): PersonalExpenseBulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const record: Record<string, string> = {}
    headers.forEach((h, i) => {
      record[h] = cells[i] ?? ""
    })
    return {
      ...emptyPersonalExpenseRow(record.date || today, record.category ?? ""),
      id: newRowId(),
      date: record.date || today,
      category: record.category ?? "",
      description: record.description ?? "",
      amount: record.amount ?? "",
    }
  })
}

export function exportEngineerBulkCsv(rows: EngineerBulkRow[], milestones: { id: string; name: string }[]) {
  const milestoneName = (id: string) => milestones.find((m) => m.id === id)?.name ?? ""
  const header = "category,milestone,description,vendor,amount"
  const body = rows.map((row) =>
    [row.category, milestoneName(row.milestoneId), row.description, row.vendor, row.amount]
      .map((v) => escapeCsv(String(v ?? "")))
      .join(","),
  )
  downloadCsv("bulk-site-expenses.csv", [header, ...body])
}

export function parseEngineerBulkCsv(
  text: string,
  milestones: { id: string; name: string }[],
): EngineerBulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const milestoneIdByName = new Map(
    milestones.map((m) => [m.name.trim().toLowerCase(), m.id]),
  )

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const record: Record<string, string> = {}
    headers.forEach((h, i) => {
      record[h] = cells[i] ?? ""
    })
    const milestoneRaw = record.milestone ?? ""
    const milestoneId =
      milestones.find((m) => m.id === milestoneRaw)?.id ??
      milestoneIdByName.get(milestoneRaw.trim().toLowerCase()) ??
      ""

    return {
      id: newRowId(),
      category: record.category ?? "",
      milestoneId,
      description: record.description ?? "",
      vendor: record.vendor ?? "",
      amount: record.amount ?? "",
    }
  })
}
