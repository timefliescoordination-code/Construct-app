import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { toDateInputValue } from "./bulk-entry-dates.ts"

describe("toDateInputValue", () => {
  it("keeps ISO dates", () => {
    assert.equal(toDateInputValue("2026-08-24"), "2026-08-24")
  })

  it("converts India-style dd/mm/yyyy for the date input", () => {
    assert.equal(toDateInputValue("24/08/2026"), "2026-08-24")
    assert.equal(toDateInputValue("24-08-2026"), "2026-08-24")
    assert.equal(toDateInputValue("4/8/26"), "2026-08-04")
  })

  it("swaps US-style dates when the middle part is a day", () => {
    assert.equal(toDateInputValue("08/24/2026"), "2026-08-24")
  })
})
