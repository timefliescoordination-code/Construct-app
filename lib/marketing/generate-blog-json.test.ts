import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VRA_BLOG_SECTION_TYPES } from './blog-types.ts'
import {
  buildBlogJsonBundle,
  buildBlogTopic,
  generateVraBlogJson,
  isAllowedBlogSectionType,
  serializeVraBlogJson,
  slugifyBlogTitle,
} from './generate-blog-json.ts'
import { sanitizeProject } from './sanitize-project.ts'
import type { RawProjectInput } from './types.ts'
import { buildVraBlogJsonPrompt } from './vra-blog-prompt.ts'

const FIXTURE: RawProjectInput = {
  id: '11111111-1111-4111-8111-111111111111',
  name: "John's Dream Villa",
  status: 'completed',
  clientName: 'John Example',
  siteAddress: '123 Example Street, Example Nagar',
  contractValue: 4_872_319,
  additionalWorksValue: 0,
  startDate: '2024-01-15',
  expectedCompletionDate: '2025-04-15',
  milestones: [{ name: 'Foundation' }, { name: 'Finishing' }],
  expenses: [
    {
      amount: 2391,
      category: 'Materials',
      status: 'approved',
      vendorName: 'ABC Steel Suppliers',
      billNumber: 'INV-2026-001',
      description: 'Cement - bags',
    },
    {
      amount: 2392,
      category: 'Materials',
      status: 'approved',
      description: 'Steel delivery for villa',
    },
    { amount: 3127, category: 'Labour', status: 'approved' },
  ],
  proposal: {
    method: 'sqft',
    proposalNumber: 'VRA-106',
    builtUpQuantity: 2478,
  },
}

describe('generateVraBlogJson', () => {
  it('emits a website-ready blog object with allowed section types only', () => {
    const data = sanitizeProject(FIXTURE)
    const post = generateVraBlogJson(data)
    assert.equal(post.type, 'blog')
    assert.ok(post.title)
    assert.equal(post.category, 'Case Study')
    assert.ok(post.sections.length > 0)
    assert.ok(post.sections.every((section) => isAllowedBlogSectionType(section.type)))
    assert.equal(
      post.sections.every((section) =>
        (VRA_BLOG_SECTION_TYPES as readonly string[]).includes(section.type),
      ),
      true,
    )
    const grid = post.sections.find((section) => section.type === 'cost_grid')
    assert.ok(grid && grid.type === 'cost_grid')
    assert.equal(grid.rows.length, 3)
    assert.equal(grid.rows[0]?.item, 'Materials')
    assert.match(grid.rows[0]?.note ?? '', /₹/)
    const json = serializeVraBlogJson(post)
    assert.equal(json.includes('```'), false)
    assert.equal(json.includes("John's Dream Villa"), false)
    assert.equal(json.includes('Steel delivery for villa'), false)
    assert.equal(json.includes('ABC Steel'), false)
    assert.equal(json.includes('INV-2026-001'), false)
    assert.equal(json.includes('VRA-106'), false)
    assert.doesNotMatch(json, /```/)
    JSON.parse(json)
  })
})

describe('JSON prompt', () => {
  it('prefixes the website admin instruction and fills the topic', () => {
    const data = sanitizeProject(FIXTURE)
    const topic = buildBlogTopic(data)
    const prompt = buildVraBlogJsonPrompt(topic)
    assert.match(prompt, /^Generate a VRA Homes blog post as JSON only/)
    assert.match(prompt, /type must be exactly "blog"/)
    assert.match(prompt, /Topic for this post: "/)
    assert.ok(prompt.endsWith('"'))
    assert.match(prompt, /cost_grid/)
    assert.equal(prompt.includes('```'), false)
    const bundle = buildBlogJsonBundle(data)
    assert.equal(bundle.jsonPrompt, prompt)
    assert.match(bundle.jsonPrompt, /Chennai/)
  })
})

describe('slugifyBlogTitle', () => {
  it('returns kebab-case without punctuation', () => {
    assert.equal(slugifyBlogTitle('A Mid-Size Family Home'), 'a-mid-size-family-home')
  })
})
