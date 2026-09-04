import type { PublicBlogImage, PublicCaseStudy } from './types.ts'

export const SEO_TITLE_MAX = 60
export const SEO_EXCERPT_MAX = 160
export const SEO_SLUG_MAX = 80

const PRIMARY_PHRASE = 'house construction cost in Chennai'

export function clipAtWord(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace >= Math.min(40, max - 20) ? cut.slice(0, lastSpace) : cut.trimEnd()
  return base.replace(/[.,;:–—\-\s]+$/u, '')
}

export function slugifyBlogTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.slice(0, SEO_SLUG_MAX) || 'vra-homes-case-study'
}

/** Drop trailing "residence" so titles read "0.5 Cr house", not "0.5 Cr residence house". */
export function scaleForSeo(costBand: string): string {
  return costBand.replace(/\s+residence$/i, '').trim()
}

export function seoTitle(data: PublicCaseStudy): string {
  if (data.costBand) {
    return clipAtWord(`${scaleForSeo(data.costBand)} ${PRIMARY_PHRASE}`, SEO_TITLE_MAX)
  }
  return clipAtWord(`House construction cost in Chennai: a real build`, SEO_TITLE_MAX)
}

export function seoExcerpt(data: PublicCaseStudy): string {
  const scale = data.costBand ? `a ${data.costBand}` : 'an independent house'
  const extras: string[] = []
  if (data.sizeBand) extras.push(data.sizeBand)
  if (data.durationBand) extras.push(`${data.durationBand} on site`)
  const extra = extras.length ? ` ${extras.join('; ')}.` : ''
  return clipAtWord(
    `House construction cost in Chennai for ${scale}: materials, labour, and time.${extra} A VRA Homes case study, not a quotation.`,
    SEO_EXCERPT_MAX,
  )
}

export function seoSlug(data: PublicCaseStudy): string {
  const home = slugifyBlogTitle(data.title).replace(/^a-/, '')
  const parts = ['house-construction-cost-chennai']
  if (data.costBand) parts.push(slugifyBlogTitle(scaleForSeo(data.costBand)))
  if (home) parts.push(home)
  return slugifyBlogTitle(parts.join(' '))
}

export function seoTagline(data: PublicCaseStudy): string {
  const details = [data.sizeBand, data.costBand, data.durationBand].filter(Boolean)
  if (details.length) return `${PRIMARY_PHRASE} · ${details.join(' · ')}`
  return 'House construction cost · Chennai · independent home'
}

export function seoImageCaption(image: PublicBlogImage): string {
  const raw = image.caption.trim()
  if (image.kind === 'design') {
    const label = raw && raw !== 'Design drawing' ? raw : 'Design drawing'
    return `${label} for a house in Chennai`
  }
  const label = raw && raw !== 'On site' ? raw : 'Site progress'
  return `${label} — house construction in Chennai`
}

export function seoFaqItems(data: PublicCaseStudy): Array<{ q: string; a: string }> {
  const scale = data.costBand ? `a ${data.costBand}` : 'a Chennai house of this scale'
  const size = data.sizeBand ? ` This one sat in the ${data.sizeBand} size.` : ''
  const duration = data.durationBand
    ? ` This house was on site for ${data.durationBand}.`
    : ' Most independent houses in Chennai take a year or more, depending on soil, access, and finishing.'
  return [
    {
      q: 'How much does it cost to build a house in Chennai?',
      a: `It depends on plot, specification, and how you finish the house. This case study is ${scale}: you can see materials, labour, equipment, and miscellaneous as they actually landed — not a lump-sum guess.${size} Use that mix to ask better questions, not to copy a rate.`,
    },
    {
      q: 'How long does it take to build a house in Chennai?',
      a: `Curing, weather, and waiting for the next trade are part of a real build.${duration} Ask your builder for a sequence of stages, not a banner date on a hoarding.`,
    },
    {
      q: 'What is included in house construction cost?',
      a: 'A useful picture splits materials, labour, equipment, and miscellaneous — with a short description of each line, not only a category name. That is what a new homeowner should ask to see before comparing quotations for a house in Chennai.',
    },
    {
      q: 'Does every house in the same Crore range cost the same?',
      a: 'No. Soil, plot access, finishing, and how extras are written down move the mix. Use a rounded Crore figure to talk scale, then open the spend list. Do not copy another house as a rate.',
    },
    {
      q: 'Can I treat this article as a quotation?',
      a: 'No. This is one independent house, already built. Your drawing, plot, and timing will differ. Use it to ask better questions of a Chennai builder, not to copy a number onto a quotation.',
    },
    {
      q: 'What should I ask a builder in Chennai before I start?',
      a: 'Walk me through materials versus labour at this scale. Show me a spend list with descriptions. Tell me which construction stages you will report, and how extras get written down.',
    },
  ]
}
