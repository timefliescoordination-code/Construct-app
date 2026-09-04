import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkMarkdownPrivacy } from './privacy-check.ts'

const DIRTY = `
# John's Dream Villa
Client John Example, phone 9876543210, email john@example.com
Address 123 Example Street, Example Nagar
Proposal VRA-106, invoice INV-2026-001, vendor ABC Steel Suppliers
Built-up 2478 sqft, contract ₹4872319, year 2026
Supply and install 12mm TMT reinforcement...
Photo https://cdn.example.com/site-photos/front.jpg
`

describe('checkMarkdownPrivacy', () => {
  it('flags the fixture identifiers and generic leak patterns', () => {
    const result = checkMarkdownPrivacy(DIRTY, [
      'John Example',
      '9876543210',
      'john@example.com',
      '123 Example Street, Example Nagar',
      "John's Dream Villa",
      'VRA-106',
      '2478',
      '4872319',
      'INV-2026-001',
      'ABC Steel Suppliers',
      'Supply and install 12mm TMT reinforcement...',
    ])
    assert.equal(result.ok, false)
    const blob = result.issues.join(' | ').toLowerCase()
    assert.match(blob, /john example/)
    assert.match(blob, /phone|9876543210/)
    assert.match(blob, /email/)
    assert.match(blob, /address/)
    assert.match(blob, /dream villa/)
    assert.match(blob, /vra-/)
    assert.match(blob, /year/)
    assert.match(blob, /4872319/)
    assert.match(blob, /sq\.?ft|2478/)
    assert.match(blob, /invoice/)
    assert.match(blob, /boq|tmt|supply/)
    assert.match(blob, /url|file/)
    assert.match(blob, /abc steel/)
  })

  it('accepts banded public language', () => {
    const clean = `# A Mid-Size Family Home

- Approximate size band: 1,500–2,500 sq.ft
- Approximate cost band: Under ₹50 lakh
- Approximate construction duration: 12–18 months

Quoted on a built-up-area basis.

Categories recorded: Materials, Labour, Equipment, Miscellaneous.

Subcategories recorded: Cement, Mixer.

| Category | Subcategory | Amount | Entries |
|---|---|---:|---:|
| Materials | Cement | ₹2,391 | 1 |
| Materials |  | ₹2,392 | 1 |
| Labour |  | ₹3,127 | 1 |
| Equipment | Mixer | ₹1,211 | 1 |
| Miscellaneous |  | ₹879 | 1 |
`
    const result = checkMarkdownPrivacy(clean, [
      'John Example',
      "John's Dream Villa",
      'VRA-106',
      '2478',
      '4872319',
    ])
    assert.equal(result.ok, true, result.issues.join(', '))
  })
})
