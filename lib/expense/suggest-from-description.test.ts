import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { ExpenseCategoryView } from "../data/expense-categories.ts"
import { DEFAULT_EXPENSE_CATEGORIES } from "../expense-categories/constants.ts"
import type { ProjectBulkRow } from "./bulk-entry-types.ts"
import {
  applyProjectRowSuggestions,
  applySuggestionsToProjectRows,
  suggestFromDescription,
  type SuggestContext,
} from "./suggest-from-description.ts"

function catalog(): ExpenseCategoryView[] {
  return DEFAULT_EXPENSE_CATEGORIES.map((category, index) => ({
    id: String(index),
    name: category.name,
    usesLabourTeams: category.usesLabourTeams,
    subcategories: category.subcategories.map((name, subIndex) => ({
      id: `${index}-${subIndex}`,
      name,
    })),
  }))
}

function context(overrides: Partial<SuggestContext> = {}): SuggestContext {
  return {
    categories: catalog(),
    milestones: [
      { id: "ms-foundation", name: "Foundation" },
      { id: "ms-plinth", name: "Plinth" },
      { id: "ms-super", name: "Superstructure" },
    ],
    labourTeams: [{ id: "team-a", name: "Team A Masons" }],
    history: [],
    ...overrides,
  }
}

function emptyRow(overrides: Partial<ProjectBulkRow> = {}): ProjectBulkRow {
  return {
    id: "row-1",
    date: "2026-08-24",
    category: "",
    subcategory: "",
    labourTeamId: "",
    milestoneId: "",
    description: "",
    amount: "",
    vendor: "",
    ...overrides,
  }
}

describe("suggestFromDescription", () => {
  it("maps TMT/rebar synonyms to Steel under Materials", () => {
    const suggestion = suggestFromDescription("TMT bars 12mm for columns", context())
    assert.equal(suggestion.category, "Materials")
    assert.equal(suggestion.subcategory, "Steel")
  })

  it("maps cement brand text to Cement", () => {
    const suggestion = suggestFromDescription("UltraTech 50 bags", context())
    assert.equal(suggestion.category, "Materials")
    assert.equal(suggestion.subcategory, "Cement")
  })

  it("maps labour wages to the Labour category", () => {
    const suggestion = suggestFromDescription("mason wages for first floor", context())
    assert.equal(suggestion.category, "Labour")
  })

  it("maps JCB hire to Excavator and Foundation milestone", () => {
    const suggestion = suggestFromDescription("JCB for foundation excavation", context())
    assert.equal(suggestion.category, "Equipment")
    assert.equal(suggestion.subcategory, "Excavator")
    assert.equal(suggestion.milestoneId, "ms-foundation")
  })

  it("reuses category, subcategory, and milestone from similar project history", () => {
    const suggestion = suggestFromDescription("ultratech extra bags site 2", context({
      history: [
        {
          category: "Materials",
          description: "Cement - UltraTech 50 bags site 1",
          milestoneId: "ms-plinth",
          labourTeamId: null,
        },
      ],
    }))
    assert.equal(suggestion.category, "Materials")
    assert.equal(suggestion.subcategory, "Cement")
    assert.equal(suggestion.milestoneId, "ms-plinth")
  })

  it("matches a labour team name in the description", () => {
    const suggestion = suggestFromDescription("Team A Masons weekly wages", context())
    assert.equal(suggestion.category, "Labour")
    assert.equal(suggestion.labourTeamId, "team-a")
  })
})

describe("applyProjectRowSuggestions", () => {
  it("fills only empty cells and never overwrites user values", () => {
    const suggestion = suggestFromDescription("TMT bars 12mm", context())
    const { row, filled } = applyProjectRowSuggestions(
      emptyRow({
        category: "Materials",
        subcategory: "Paint",
        description: "TMT bars 12mm",
      }),
      suggestion,
      catalog(),
    )
    assert.equal(row.category, "Materials")
    assert.equal(row.subcategory, "Paint")
    assert.equal(filled.includes("subcategory"), false)
    assert.equal(filled.includes("category"), false)
  })

  it("fills a milestone even when category is still empty", () => {
    const { row, filled } = applyProjectRowSuggestions(
      emptyRow(),
      { milestoneId: "ms-foundation" },
      catalog(),
    )
    assert.equal(row.milestoneId, "ms-foundation")
    assert.equal(filled.includes("milestoneId"), true)
    assert.equal(row.category, "")
  })

  it("fills empty category and subcategory from a catalog match", () => {
    const suggestion = suggestFromDescription("TMT bars 12mm", context())
    const { row, filled } = applyProjectRowSuggestions(emptyRow(), suggestion, catalog())
    assert.equal(row.category, "Materials")
    assert.equal(row.subcategory, "Steel")
    assert.equal(filled.includes("category"), true)
    assert.equal(filled.includes("subcategory"), true)
  })
})

describe("applySuggestionsToProjectRows", () => {
  it("skips rows without a description", () => {
    const { rows, suggested } = applySuggestionsToProjectRows(
      [emptyRow({ id: "blank" }), emptyRow({ id: "tmt", description: "rebar 16mm" })],
      context(),
    )
    assert.equal(rows[0].category, "")
    assert.equal(rows[1].subcategory, "Steel")
    assert.equal(suggested.blank, undefined)
    assert.equal(suggested.tmt?.subcategory, true)
  })
})
