import type { ExpenseCategoryView } from "../data/expense-categories.ts"
import {
  categoryUsesLabourTeams,
  inheritEmptyProjectFields,
  previousProjectRowWithValues,
} from "./bulk-entry-project.ts"
import type { ProjectBulkRow } from "./bulk-entry-types.ts"
import { parseExpenseSubcategory } from "./export/parse.ts"

export type ExpenseHistoryItem = {
  category: string
  description: string
  milestoneId: string | null
  labourTeamId: string | null
}

export type SuggestContext = {
  categories: ExpenseCategoryView[]
  milestones: { id: string; name: string }[]
  labourTeams: { id: string; name: string }[]
  history: ExpenseHistoryItem[]
}

export type FieldSuggestion = {
  category?: string
  subcategory?: string
  labourTeamId?: string
  milestoneId?: string
}

export type SuggestedFieldKey = "category" | "subcategory" | "labourTeamId" | "milestoneId"

export type SuggestedFieldMap = Record<string, Partial<Record<SuggestedFieldKey, true>>>

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "for",
  "and",
  "to",
  "with",
  "from",
  "bags",
  "nos",
  "no",
  "kg",
  "mm",
  "rs",
  "inr",
  "qty",
  "pcs",
  "pc",
])

const CATALOG_THRESHOLD = 40
const HISTORY_MIN_SCORE = 0.25

/** Maps description tokens/phrases to catalog category, subcategory, or milestone names. */
const SYNONYMS: Array<{ match: string; name: string }> = [
  { match: "tmt bar", name: "Steel" },
  { match: "tmtbar", name: "Steel" },
  { match: "tmt", name: "Steel" },
  { match: "rebar", name: "Steel" },
  { match: "reinforcement", name: "Steel" },
  { match: "ultratech", name: "Cement" },
  { match: "opc", name: "Cement" },
  { match: "ppc", name: "Cement" },
  { match: "m sand", name: "Sand" },
  { match: "m-sand", name: "Sand" },
  { match: "msand", name: "Sand" },
  { match: "river sand", name: "Sand" },
  { match: "flyash", name: "Bricks" },
  { match: "aac", name: "Bricks" },
  { match: "brick", name: "Bricks" },
  { match: "vitrified", name: "Tiles" },
  { match: "granite", name: "Tiles" },
  { match: "marble", name: "Tiles" },
  { match: "tile", name: "Tiles" },
  { match: "distemper", name: "Paint" },
  { match: "emulsion", name: "Paint" },
  { match: "primer", name: "Paint" },
  { match: "faucet", name: "Plumbing" },
  { match: "pipe", name: "Plumbing" },
  { match: "pvc", name: "Plumbing" },
  { match: "tap", name: "Plumbing" },
  { match: "cable", name: "Electrical" },
  { match: "mcb", name: "Electrical" },
  { match: "switch", name: "Electrical" },
  { match: "wire", name: "Electrical" },
  { match: "poclain", name: "Excavator" },
  { match: "jcb", name: "Excavator" },
  { match: "transit mixer", name: "Mixer" },
  { match: "concrete mixer", name: "Mixer" },
  { match: "diesel", name: "Transportation" },
  { match: "petrol", name: "Transportation" },
  { match: "fuel", name: "Transportation" },
  { match: "lorry", name: "Transportation" },
  { match: "transport", name: "Transportation" },
  { match: "trip", name: "Transportation" },
  { match: "mason", name: "Labour" },
  { match: "carpenter", name: "Labour" },
  { match: "helper", name: "Labour" },
  { match: "wages", name: "Labour" },
  { match: "labour", name: "Labour" },
  { match: "foundation", name: "Foundation" },
  { match: "footing", name: "Foundation" },
  { match: "plinth", name: "Plinth" },
  { match: "shuttering", name: "Superstructure" },
  { match: "slab", name: "Superstructure" },
]

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9&+]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
}

function nameScore(haystack: string, tokens: Set<string>, name: string): number {
  const needle = name.trim().toLowerCase()
  if (!needle) return 0
  if (haystack.includes(needle) && needle.length >= 3) return 80 + needle.length
  const nameTokens = tokenize(name)
  if (nameTokens.length === 0) return 0
  const hits = nameTokens.filter((token) => tokens.has(token))
  if (hits.length === nameTokens.length) return 50 + needle.length
  if (nameTokens.length > 1 && hits.length / nameTokens.length >= 0.6) {
    return 20 + hits.length * 5
  }
  return 0
}

function matchesSynonym(haystack: string, tokens: Set<string>, match: string): boolean {
  const needle = match.toLowerCase()
  if (needle.includes(" ") || needle.includes("-")) return haystack.includes(needle)
  return tokens.has(needle)
}

function findSubcategory(
  categories: ExpenseCategoryView[],
  name: string,
): { name: string; category: string } | null {
  const target = name.trim().toLowerCase()
  for (const category of categories) {
    if (category.usesLabourTeams) continue
    const sub = category.subcategories.find((item) => item.name.trim().toLowerCase() === target)
    if (sub) return { name: sub.name, category: category.name }
  }
  return null
}

function findCategory(categories: ExpenseCategoryView[], name: string): string | null {
  const target = name.trim().toLowerCase()
  return categories.find((category) => category.name.trim().toLowerCase() === target)?.name ?? null
}

function findMilestone(
  milestones: { id: string; name: string }[],
  name: string,
): { id: string; name: string } | null {
  const target = name.trim().toLowerCase()
  return milestones.find((milestone) => milestone.name.trim().toLowerCase() === target) ?? null
}

function matchHistory(
  description: string,
  history: ExpenseHistoryItem[],
): ExpenseHistoryItem | null {
  const tokens = tokenize(description)
  if (tokens.length === 0 || history.length === 0) return null

  let best: { item: ExpenseHistoryItem; score: number } | null = null
  for (const item of history) {
    const other = new Set(tokenize(item.description))
    const overlap = tokens.filter((token) => other.has(token))
    if (overlap.length === 0) continue
    const longShared = overlap.some((token) => token.length >= 5)
    if (overlap.length < 2 && !longShared) continue
    const score = overlap.length / Math.max(tokens.length, other.size, 1)
    if (!best || score > best.score) best = { item, score }
  }

  return best && best.score >= HISTORY_MIN_SCORE ? best.item : null
}

function suggestionFromHistory(item: ExpenseHistoryItem): FieldSuggestion {
  const parsed = parseExpenseSubcategory(item.description)
  const suggestion: FieldSuggestion = {}
  if (item.category) suggestion.category = item.category
  if (item.milestoneId) suggestion.milestoneId = item.milestoneId
  if (item.labourTeamId) suggestion.labourTeamId = item.labourTeamId
  if (parsed.subcategory) suggestion.subcategory = parsed.subcategory
  return suggestion
}

export function suggestFromDescription(
  description: string,
  context: SuggestContext,
): FieldSuggestion {
  const trimmed = description.trim()
  if (!trimmed) return {}

  const haystack = trimmed.toLowerCase()
  const tokens = new Set(tokenize(trimmed))
  const result: FieldSuggestion = {}

  let bestSub: { name: string; category: string; score: number } | null = null
  for (const category of context.categories) {
    if (category.usesLabourTeams) continue
    for (const sub of category.subcategories) {
      const score = nameScore(haystack, tokens, sub.name)
      if (score > (bestSub?.score ?? 0)) {
        bestSub = { name: sub.name, category: category.name, score }
      }
    }
  }

  let bestCategory: { name: string; score: number } | null = null
  for (const category of context.categories) {
    const score = nameScore(haystack, tokens, category.name)
    if (score > (bestCategory?.score ?? 0)) {
      bestCategory = { name: category.name, score }
    }
  }

  let bestTeam: { id: string; score: number } | null = null
  for (const team of context.labourTeams) {
    const score = nameScore(haystack, tokens, team.name)
    if (score > (bestTeam?.score ?? 0)) bestTeam = { id: team.id, score }
  }

  let bestMilestone: { id: string; score: number } | null = null
  for (const milestone of context.milestones) {
    const score = nameScore(haystack, tokens, milestone.name)
    if (score > (bestMilestone?.score ?? 0)) {
      bestMilestone = { id: milestone.id, score }
    }
  }

  for (const synonym of SYNONYMS) {
    if (!matchesSynonym(haystack, tokens, synonym.match)) continue
    const score = 90 + synonym.match.length
    const sub = findSubcategory(context.categories, synonym.name)
    if (sub && score > (bestSub?.score ?? 0)) {
      bestSub = { ...sub, score }
    }
    const categoryName = findCategory(context.categories, synonym.name)
    if (categoryName && score > (bestCategory?.score ?? 0)) {
      bestCategory = { name: categoryName, score }
    }
    const milestone = findMilestone(context.milestones, synonym.name)
    if (milestone && score > (bestMilestone?.score ?? 0)) {
      bestMilestone = { id: milestone.id, score }
    }
  }

  if (bestSub && bestSub.score >= CATALOG_THRESHOLD) {
    result.category = bestSub.category
    result.subcategory = bestSub.name
  } else if (bestCategory && bestCategory.score >= CATALOG_THRESHOLD) {
    result.category = bestCategory.name
  }

  if (bestTeam && bestTeam.score >= CATALOG_THRESHOLD) {
    result.labourTeamId = bestTeam.id
  }
  if (bestMilestone && bestMilestone.score >= CATALOG_THRESHOLD) {
    result.milestoneId = bestMilestone.id
  }

  const historyItem = matchHistory(trimmed, context.history)
  if (historyItem) {
    const fromHistory = suggestionFromHistory(historyItem)
    if (!result.category && fromHistory.category) result.category = fromHistory.category
    if (!result.subcategory && fromHistory.subcategory) {
      result.subcategory = fromHistory.subcategory
    }
    if (!result.labourTeamId && fromHistory.labourTeamId) {
      result.labourTeamId = fromHistory.labourTeamId
    }
    if (!result.milestoneId && fromHistory.milestoneId) {
      result.milestoneId = fromHistory.milestoneId
    }
  }

  return result
}

export function applyProjectRowSuggestions(
  row: ProjectBulkRow,
  suggestion: FieldSuggestion,
  categories: ExpenseCategoryView[],
): { row: ProjectBulkRow; filled: SuggestedFieldKey[] } {
  const next = { ...row }
  const filled: SuggestedFieldKey[] = []

  if (!next.category.trim() && suggestion.category) {
    next.category = suggestion.category
    filled.push("category")
  }

  if (!next.milestoneId.trim() && suggestion.milestoneId) {
    next.milestoneId = suggestion.milestoneId
    filled.push("milestoneId")
  }

  if (!next.category.trim()) return { row: next, filled }

  const usesLabour = categoryUsesLabourTeams(next.category, categories)
  if (usesLabour) {
    if (!next.labourTeamId.trim() && suggestion.labourTeamId) {
      next.labourTeamId = suggestion.labourTeamId
      filled.push("labourTeamId")
    }
  } else if (!next.subcategory.trim() && suggestion.subcategory) {
    const allowed =
      categories
        .find((category) => category.name === next.category)
        ?.subcategories.map((sub) => sub.name) ?? []
    if (allowed.includes(suggestion.subcategory)) {
      next.subcategory = suggestion.subcategory
      filled.push("subcategory")
    }
  }

  return { row: next, filled }
}

export function applySuggestionsToProjectRows(
  rows: ProjectBulkRow[],
  context: SuggestContext,
): { rows: ProjectBulkRow[]; suggested: SuggestedFieldMap } {
  const suggested: SuggestedFieldMap = {}
  const nextRows = rows.map((row) => {
    if (!row.description.trim()) return row
    const suggestion = suggestFromDescription(row.description, context)
    const { row: updated, filled } = applyProjectRowSuggestions(
      row,
      suggestion,
      context.categories,
    )
    if (filled.length > 0) {
      suggested[updated.id] = Object.fromEntries(filled.map((key) => [key, true])) as Partial<
        Record<SuggestedFieldKey, true>
      >
    }
    return updated
  })

  const withInherited = nextRows.map((row, index) => {
    if (!row.description.trim()) return row
    const previous = previousProjectRowWithValues(nextRows, index)
    const inherited = inheritEmptyProjectFields(row, previous)
    if (inherited.milestoneId && !row.milestoneId) {
      suggested[inherited.id] = { ...suggested[inherited.id], milestoneId: true }
    }
    return inherited
  })

  return { rows: withInherited, suggested }
}

export function mergeSuggestedFieldMaps(
  current: SuggestedFieldMap,
  incoming: SuggestedFieldMap,
): SuggestedFieldMap {
  const next: SuggestedFieldMap = { ...current }
  for (const [rowId, fields] of Object.entries(incoming)) {
    next[rowId] = { ...next[rowId], ...fields }
  }
  return next
}

export function clearSuggestedFields(
  map: SuggestedFieldMap,
  rowId: string,
  keys: SuggestedFieldKey[],
): SuggestedFieldMap {
  const existing = map[rowId]
  if (!existing) return map
  const nextFields = { ...existing }
  for (const key of keys) delete nextFields[key]
  const next = { ...map }
  if (Object.keys(nextFields).length === 0) delete next[rowId]
  else next[rowId] = nextFields
  return next
}
