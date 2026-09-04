import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SEO_EXCERPT_MAX,
  SEO_TITLE_MAX,
  clipAtWord,
  scaleForSeo,
  seoExcerpt,
  seoFaqItems,
  seoImageCaption,
  seoSlug,
  seoTagline,
  seoTitle,
  slugifyBlogTitle,
} from './blog-seo.ts'
import type { PublicCaseStudy } from './types.ts'

const DATA: PublicCaseStudy = {
  title: 'A Mid-Size Family Home',
  buildingType: 'Residential construction',
  sizeBand: '1,500–2,500 sq.ft',
  costBand: '0.5 Cr residence',
  durationBand: '12–18 months',
  stages: ['Foundation'],
  qualityAreas: [],
  scopeChangeCategories: [],
}

describe('clipAtWord', () => {
  it('does not cut mid-word when it can break on a space', () => {
    assert.equal(clipAtWord('house construction cost in Chennai extra', 28), 'house construction cost in')
  })

  it('returns the original when already short enough', () => {
    assert.equal(clipAtWord('short title', 60), 'short title')
  })
})

describe('scaleForSeo', () => {
  it('drops trailing residence so titles do not read residence house', () => {
    assert.equal(scaleForSeo('0.5 Cr residence'), '0.5 Cr')
    assert.equal(scaleForSeo('1.2 Cr residence'), '1.2 Cr')
  })
})

describe('seoTitle', () => {
  it('front-loads Crore scale and the Chennai cost phrase under 60 characters', () => {
    const title = seoTitle(DATA)
    assert.equal(title, '0.5 Cr house construction cost in Chennai')
    assert.ok(title.length <= SEO_TITLE_MAX)
    assert.equal(title.includes('residence house'), false)
  })

  it('still names Chennai when there is no cost band', () => {
    const title = seoTitle({ ...DATA, costBand: undefined })
    assert.match(title, /House construction cost in Chennai/)
    assert.ok(title.length <= SEO_TITLE_MAX)
  })
})

describe('seoExcerpt', () => {
  it('fits a meta description and includes the primary phrase', () => {
    const excerpt = seoExcerpt(DATA)
    assert.match(excerpt, /House construction cost in Chennai/)
    assert.match(excerpt, /0\.5 Cr residence/)
    assert.ok(excerpt.length >= 120)
    assert.ok(excerpt.length <= SEO_EXCERPT_MAX)
  })
})

describe('seoSlug', () => {
  it('includes the cost keyword, city, and scale', () => {
    const slug = seoSlug(DATA)
    assert.match(slug, /house-construction-cost-chennai/)
    assert.match(slug, /0-5-cr/)
    assert.match(slug, /mid-size-family-home/)
    assert.ok(slug.length <= 80)
    assert.equal(slug, slugifyBlogTitle(slug))
  })
})

describe('seoTagline', () => {
  it('leads with the primary phrase then the bands', () => {
    assert.match(seoTagline(DATA), /^house construction cost in Chennai/i)
    assert.match(seoTagline(DATA), /0\.5 Cr residence/)
  })
})

describe('seoImageCaption', () => {
  it('writes descriptive Chennai captions instead of file names', () => {
    assert.equal(
      seoImageCaption({ src: '/a.jpg', caption: 'Design drawing', kind: 'design' }),
      'Design drawing for a house in Chennai',
    )
    assert.equal(
      seoImageCaption({ src: '/b.jpg', caption: 'On site', kind: 'site' }),
      'Site progress — house construction in Chennai',
    )
  })
})

describe('seoFaqItems', () => {
  it('answers People Also Ask cost and duration questions', () => {
    const items = seoFaqItems(DATA)
    const questions = items.map((item) => item.q)
    assert.ok(questions.includes('How much does it cost to build a house in Chennai?'))
    assert.ok(questions.includes('How long does it take to build a house in Chennai?'))
    assert.ok(questions.includes('What is included in house construction cost?'))
    assert.equal(
      questions.some((question) => /1 Cr/.test(question)),
      false,
    )
    assert.match(items[0]?.a ?? '', /0\.5 Cr residence/)
  })
})
