import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildMarketingDraft, buildMarketingPortfolio, forbiddenTokensFromProject } from './build-case-study.ts'
import { countWords } from './generate-markdown.ts'
import { splitCaseStudyAroundExpenses } from './split-case-study.ts'
import { anonymousProjectTitle } from './fake-title.ts'
import { sanitizeProject } from './sanitize-project.ts'
import type { RawProjectInput } from './types.ts'

const FIXTURE: RawProjectInput = {
  id: '11111111-1111-4111-8111-111111111111',
  name: "John's Dream Villa",
  status: 'completed',
  clientName: 'John Example',
  clientPhone: '9876543210',
  clientEmail: 'john@example.com',
  siteAddress: '123 Example Street, Example Nagar',
  contractValue: 4_872_319,
  additionalWorksValue: 0,
  startDate: '2024-01-15',
  expectedCompletionDate: '2025-04-15',
  milestones: [
    { name: 'Foundation' },
    { name: 'Plinth' },
    { name: 'Superstructure' },
    { name: 'Brickwork' },
    { name: 'Penthouse Lounge Fit-out' },
    { name: 'Electrical & Plumbing' },
    { name: 'Flooring & Tiling' },
    { name: 'Finishing' },
  ],
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
      vendorName: 'ABC Steel Suppliers',
      billNumber: 'INV-2026-001',
      description: 'Steel delivery for villa',
    },
    { amount: 3127, category: 'Labour', status: 'approved', vendorName: 'Local Crew', description: 'Mason wages' },
    { amount: 1211, category: 'Equipment', status: 'approved', vendorName: 'Hire Co', description: 'Mixer - daily hire' },
    { amount: 879, category: 'Miscellaneous', status: 'approved', description: 'Night haul of leftover shuttering' },
    { amount: 99999, category: 'Materials', status: 'pending', vendorName: 'Should Ignore', description: 'Rejected leak' },
  ],
  additionalWorks: [],
  changeRequests: [
    {
      category: 'design',
      status: 'approved',
      requestNumber: 'CR-001',
      title: 'Move the pooja wall',
      description: 'Client wants extra niches near the dining',
    },
    {
      category: 'material',
      status: 'completed',
      requestNumber: 'CR-002',
      title: 'Italian marble upgrade',
      description: 'Replace local stone with imported marble',
    },
  ],
  proposal: {
    method: 'sqft',
    proposalNumber: 'VRA-106',
    builtUpQuantity: 2478,
    clientName: 'John Example',
    clientPhone: '9876543210',
    clientEmail: 'john@example.com',
    projectName: "John's Dream Villa",
    siteAddress: '123 Example Street, Example Nagar',
  },
  inspectionWorkTypes: ['foundation', 'rcc', 'brickwork', 'waterproofing', 'electrical', 'plumbing', 'other'],
  staffNames: ['Priya Sharma', 'Rahul Site Engineer'],
  contractorNames: ['ABC Steel Suppliers'],
  privateSnippets: [
    'Supply and install 12mm TMT reinforcement...',
    'https://cdn.example.com/site-photos/front.jpg',
    'front.jpg',
  ],
}

const LEAKS = [
  'John Example',
  '9876543210',
  'john@example.com',
  '123 Example Street',
  'Example Nagar',
  "John's Dream Villa",
  'Johns Dream Villa',
  'VRA-106',
  '2478',
  '4872319',
  '4,872,319',
  '48,72,319',
  'INV-2026-001',
  'ABC Steel Suppliers',
  'Supply and install 12mm TMT',
  '12mm TMT',
  'Penthouse Lounge',
  'Move the pooja wall',
  'Italian marble',
  'Priya Sharma',
  'Rahul Site Engineer',
  'https://cdn.example.com/site-photos/front.jpg',
  'front.jpg',
  'CR-001',
  'Local Crew',
]

function assertNoLeaks(markdown: string) {
  const lower = markdown.toLowerCase()
  for (const leak of LEAKS) {
    assert.equal(lower.includes(leak.toLowerCase()), false, `markdown leaked: ${leak}`)
  }
  assert.doesNotMatch(markdown, /\b(?:19|20)\d{2}\b/)
  assert.doesNotMatch(markdown, /VRA-/i)
  assert.doesNotMatch(markdown, /\b2478\b/)
  assert.doesNotMatch(markdown, /\b4872319\b/)
  assert.doesNotMatch(markdown, /\b[6-9]\d{9}\b/)
  assert.doesNotMatch(markdown, /@/)
  assert.doesNotMatch(markdown, /https?:\/\//i)
}

describe('sanitizeProject fixture', () => {
  it('keeps only banded public fields', () => {
    const publicData = sanitizeProject(FIXTURE)
    assert.equal(publicData.title, anonymousProjectTitle(FIXTURE.id))
    assert.notEqual(publicData.title, FIXTURE.name)
    assert.equal(publicData.sizeBand, '1,500–2,500 sq.ft')
    assert.equal(publicData.costBand, '0.5 Cr residence')
    assert.equal(publicData.durationBand, '12–18 months')
    assert.equal(publicData.proposalMethod, 'Quoted on a built-up-area basis')
    assert.deepEqual(
      publicData.spendMix?.map((row) => row.percent),
      [50, 30, 10, 10],
    )
    assert.equal(publicData.spendMix?.reduce((sum, row) => sum + row.percent, 0), 100)
    assert.deepEqual(publicData.expenseSheet, [
      { category: 'Materials', subcategory: 'Cement', percent: 25, amount: 2391, count: 1 },
      { category: 'Materials', subcategory: null, percent: 25, amount: 2392, count: 1 },
      { category: 'Labour', subcategory: null, percent: 30, amount: 3127, count: 1 },
      { category: 'Equipment', subcategory: 'Mixer', percent: 10, amount: 1211, count: 1 },
      { category: 'Miscellaneous', subcategory: null, percent: 10, amount: 879, count: 1 },
    ])
    assert.deepEqual(publicData.expenseLines, [
      { category: 'Materials', subcategory: 'Cement', description: 'bags', amount: 2391 },
      {
        category: 'Materials',
        subcategory: null,
        description: 'Steel delivery for villa',
        amount: 2392,
      },
      { category: 'Labour', subcategory: null, description: 'Mason wages', amount: 3127 },
      { category: 'Equipment', subcategory: 'Mixer', description: 'daily hire', amount: 1211 },
      {
        category: 'Miscellaneous',
        subcategory: null,
        description: 'Night haul of leftover shuttering',
        amount: 879,
      },
    ])
    assert.equal(
      publicData.expenseSheet
        ?.filter((row) => row.category === 'Materials')
        .reduce((sum, row) => sum + row.amount, 0),
      4783,
    )
    assert.deepEqual(publicData.subcategoriesByCategory, [
      { category: 'Materials', names: ['Cement'] },
      { category: 'Equipment', names: ['Mixer'] },
    ])
    assert.ok(publicData.stages.includes('Foundation'))
    assert.ok(publicData.stages.includes('Masonry'))
    assert.ok(publicData.stages.includes('Electrical'))
    assert.equal(publicData.stages.some((stage) => stage.includes('Penthouse')), false)
    assert.equal(publicData.scopeChangeSummary, 'A few scope changes were recorded during construction')
    assert.ok(publicData.scopeChangeCategories.includes('Design'))
    assert.ok(publicData.scopeChangeCategories.includes('Material'))
    assert.equal(publicData.additionalWorksSummary, 'The scope remained broadly aligned with the original quotation.')
    assert.ok(publicData.qualityAreas.includes('Foundation'))
    assert.ok(publicData.qualityAreas.includes('Masonry'))
    assert.equal(publicData.qualityAreas.includes('other' as never), false)
  })
})

describe('marketing draft fixture', () => {
  it('never copies private identifiers into markdown', () => {
    const draft = buildMarketingDraft(FIXTURE)
    assert.equal(draft.internalName, "John's Dream Villa")
    assert.equal(draft.internalId, FIXTURE.id)
    assert.equal(draft.copySafe, true, draft.privacyIssues.join(', '))
    assert.equal(draft.markdown.includes(draft.internalName), false)
    assert.equal(draft.markdown.includes(draft.internalId), false)
    assertNoLeaks(draft.markdown)
    assertNoLeaks(JSON.stringify(draft.blogJson))
    assert.equal(draft.blogJson.type, 'blog')
    assert.ok(draft.jsonPrompt.startsWith('Generate a VRA Homes blog post as JSON only'))
    assert.equal(draft.jsonPrompt.includes('```'), false)
    assert.match(draft.markdown, /0\.5 Cr residence/)
    assert.match(draft.markdown, /12–18 months/)
    assert.match(draft.markdown, /Categories recorded: Materials, Labour, Equipment, Miscellaneous/)
    assert.match(draft.markdown, /Subcategories recorded: Cement, Mixer/)
    assert.match(draft.markdown, /\| Materials \| Cement \| bags \| ₹2,391 \|/)
    assert.match(draft.markdown, /\| Equipment \| Mixer \| daily hire \| ₹1,211 \|/)
    assert.match(draft.markdown, /\| Labour \|  \| Mason wages \| ₹3,127 \|/)
    assert.equal(draft.markdown.includes('Steel delivery for villa'), true)
    assert.equal(draft.markdown.includes('Why is the overall contract value hidden'), false)
    assert.equal(draft.markdown.includes('100 lakh'), false)
    assert.equal(draft.expenseSheet.some((row) => row.subcategory === 'Steel'), false)
    assert.equal(draft.expenseLines.length, 5)
    assert.deepEqual(
      draft.expenseLines.map((row) => row.amount),
      [2391, 2392, 3127, 1211, 879],
    )
    const split = splitCaseStudyAroundExpenses(draft.markdown)
    assert.match(split.before, /Project Overview/)
    assert.match(split.after, /Construction Stages/)
    assert.equal(split.before.includes('| Materials | Cement |'), false)
    assert.equal(split.after.includes('| Materials | Cement |'), false)
    assert.ok(countWords(draft.markdown) >= 1500)
  })

  it('stays copy-safe when Design and site photo URLs are attached', () => {
    const withPhotos: RawProjectInput = {
      ...FIXTURE,
      blogImages: [
        {
          src: 'https://vraconstruction.app/api/projects/11111111-1111-4111-8111-111111111111/design-files/aaaa/view',
          caption: 'Design drawing',
          kind: 'design',
        },
      ],
    }
    const draft = buildMarketingDraft(withPhotos)
    assert.equal(draft.copySafe, true, draft.privacyIssues.join(', '))
    assert.ok(draft.blogJson.featured_image)
    assert.equal(draft.jsonPrompt.includes('none yet'), false)
  })

  it('omits missing data instead of inventing bands or spend mix', () => {
    const sparse: RawProjectInput = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Sparse Site',
      status: 'active',
      clientName: 'Hidden Client',
      siteAddress: '9 Secret Road',
      contractValue: 0,
      additionalWorksValue: 0,
      startDate: null,
      expectedCompletionDate: null,
      milestones: [{ name: 'Client rooftop party deck' }],
      expenses: [],
    }
    const publicData = sanitizeProject(sparse)
    assert.equal(publicData.sizeBand, undefined)
    assert.equal(publicData.costBand, undefined)
    assert.equal(publicData.durationBand, undefined)
    assert.equal(publicData.spendMix, undefined)
    assert.deepEqual(publicData.stages, [])
    const draft = buildMarketingDraft(sparse)
    assert.equal(draft.markdown.includes('Expense Distribution'), false)
    assert.equal(draft.markdown.includes('Client rooftop party deck'), false)
    assert.equal(draft.markdown.includes('Hidden Client'), false)
    assert.equal(draft.markdown.includes('9 Secret Road'), false)
    assert.equal(draft.markdown.includes('Sparse Site'), false)
  })
})

describe('recognition risk', () => {
  it('marks a unique size+cost+duration combination as HIGH', () => {
    const unique = buildMarketingPortfolio([FIXTURE])
    assert.equal(unique[0]?.recognitionRisk, 'HIGH')
  })

  it('marks a shared combination as LOW', () => {
    const peer: RawProjectInput = {
      ...FIXTURE,
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Another Family House',
      clientName: 'Other Person',
    }
    const items = buildMarketingPortfolio([FIXTURE, peer])
    assert.equal(items[0]?.recognitionRisk, 'LOW')
    assert.equal(items[1]?.recognitionRisk, 'LOW')
  })
})

describe('forbidden token collection', () => {
  it('captures fixture identity fields for the validator', () => {
    const tokens = forbiddenTokensFromProject(FIXTURE).join(' | ').toLowerCase()
    assert.match(tokens, /john example/)
    assert.match(tokens, /9876543210/)
    assert.match(tokens, /john@example.com/)
    assert.match(tokens, /vra-106/)
    assert.match(tokens, /abc steel/)
    assert.match(tokens, /12mm tmt/)
  })
})
