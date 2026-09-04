import { formatINR } from '../currency.ts'
import { formatBlogImagePromptNote } from './blog-images.ts'
import { COST_GRID_VISIBLE_ROWS } from './blog-limits.ts'
import {
  seoExcerpt,
  seoFaqItems,
  seoImageCaption,
  seoSlug,
  seoTagline,
  seoTitle,
  scaleForSeo,
} from './blog-seo.ts'
import {
  VRA_BLOG_SECTION_TYPES,
  type ComparisonVariant,
  type VraBlogPost,
  type VraBlogSection,
} from './blog-types.ts'
import type {
  PublicBlogImage,
  PublicCaseStudy,
  PublicExpenseLineItem,
  PublicSpendShare,
} from './types.ts'
import { buildVraBlogJsonPrompt } from './vra-blog-prompt.ts'
import { websiteJsonPayload } from './website-json.ts'

const COMPARISON_VARIANT: Record<string, ComparisonVariant> = {
  Materials: 'info',
  Labour: 'note',
  Equipment: 'default',
  Miscellaneous: 'warning',
}

export { slugifyBlogTitle } from './blog-seo.ts'

export function buildBlogTopic(data: PublicCaseStudy): string {
  const details = [data.sizeBand, data.costBand, data.durationBand].filter(Boolean)
  const detailText = details.length ? ` (${details.join(', ')})` : ''
  const scale = data.costBand ?? 'a Chennai home'
  return `SEO target: homeowners searching house construction cost in Chennai. Title under 60 characters with that phrase and the Crore scale. Excerpt 150–160 characters for the meta description. Slug kebab-case with house-construction-cost-chennai. Hero title must match the root title (one H1). H2s should be search questions. FAQ must answer How much does it cost to build a house in Chennai, how long it takes, and what is included. A ${scale}: what it took to build ${data.title}${detailText}. Write for a new homeowner who wants to know what a project of this scale requires — materials, people, machines, and the sequence of work. Put every approved expense in cost_grid (item = category, spec = subcategory and description, note = amount). The live table shows the first ${COST_GRID_VISIBLE_ROWS} rows; Read more opens the rest. Do not name a client, street, vendor, or invoice.`
}

function expenseRows(data: PublicCaseStudy): PublicExpenseLineItem[] {
  if (data.expenseLines?.length) return data.expenseLines
  if (data.expenseSheet?.length) {
    return data.expenseSheet.map((row) => ({
      category: row.category,
      subcategory: row.subcategory,
      description: null,
      amount: row.amount,
    }))
  }
  return (data.spendMix ?? []).map((row) => ({
    category: row.category,
    subcategory: null,
    description: null,
    amount: row.amount,
  }))
}

export function costGridSpec(row: PublicExpenseLineItem): string {
  const subcategory = row.subcategory?.trim() ?? ''
  const description = row.description?.trim() ?? ''
  if (subcategory && description) {
    if (description.toLowerCase().includes(subcategory.toLowerCase())) return description
    return `${subcategory} — ${description}`
  }
  return description || subcategory
}

function spendMixSentence(mix: PublicSpendShare[]): string {
  const largest = [...mix].sort((a, b) => b.percent - a.percent)[0]
  const parts = mix.map((row) => `${row.category.toLowerCase()} at about ${row.percent}%`)
  if (parts.length === 1) {
    return `Most of the recorded spend sat in ${parts[0]}.`
  }
  const last = parts.pop()
  return `The money split roughly ${parts.join(', ')}, and ${last}. ${largest.category} took the largest share — that is typical for a house of this size, though every plot moves a little.`
}

function appendImageSections(sections: VraBlogSection[], images: PublicBlogImage[]) {
  if (!images.length) return
  const first = images[0]
  const firstCaption = seoImageCaption(first)
  sections.push({
    type: 'image_text',
    src: first.src,
    position: 'right',
    heading: 'House construction in Chennai, as it looks on site',
    paragraphs: [
      'Drawings and site photos help a new homeowner feel the scale — not a rate card, a house going up in Chennai.',
      firstCaption,
    ],
  })
  sections.push({
    type: 'gallery',
    images: images.map((image) => ({ src: image.src, caption: seoImageCaption(image) })),
  })
}

export function generateVraBlogJson(data: PublicCaseStudy): VraBlogPost {
  const lines = expenseRows(data)
  const mix = data.spendMix ?? []
  const images = data.blogImages ?? []
  const sections: VraBlogSection[] = []
  const title = seoTitle(data)

  sections.push({
    type: 'hero',
    eyebrow: 'VRA Homes · House construction in Chennai',
    title,
    subtitle: data.costBand
      ? `${data.title}. A ${data.costBand} — here is what it actually took to get it standing.`
      : `${data.title}. Here is what it actually took to get it standing.`,
  })

  const stats = [
    data.sizeBand ? { label: 'Size', value: data.sizeBand } : null,
    data.costBand ? { label: 'This home', value: data.costBand } : null,
    data.durationBand ? { label: 'On site', value: data.durationBand } : null,
    data.proposalMethod ? { label: 'Quoted as', value: data.proposalMethod } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item))
  if (stats.length) {
    sections.push({ type: 'stats', items: stats })
  }

  sections.push({
    type: 'highlight',
    variant: 'note',
    text: data.costBand
      ? `If you are planning a new home, this is the useful question: what does a ${data.costBand} actually require — in materials, people, machines, and time?`
      : 'If you are planning a new home, this is the useful question: what does a house of this scale actually require — in materials, people, machines, and time?',
  })

  const intro: string[] = [
    `If you are searching house construction cost in Chennai, this is a clearer starting point than a lump sum: ${data.title}, built the way we build most independent houses — drawings, a sequence, and a spend list you can sit with.`,
  ]
  if (data.sizeBand && data.costBand) {
    intro.push(
      `Think ${data.sizeBand}, and a ${data.costBand}. That is the scale. It is enough to plan with, without pretending every house of this size spends the same rupee on the same Tuesday.`,
    )
  } else if (data.costBand) {
    intro.push(`This one was a ${data.costBand}.`)
  } else if (data.sizeBand) {
    intro.push(`The home sat in the ${data.sizeBand} size.`)
  }
  if (data.durationBand) {
    intro.push(
      `Work ran for ${data.durationBand}. Houses take time. Weather, curing, and waiting for the next trade are part of that, not a scandal.`,
    )
  }
  if (data.proposalMethod) {
    intro.push(`The first quotation was ${data.proposalMethod.toLowerCase()}.`)
  }
  sections.push({
    type: 'text',
    heading: data.costBand
      ? `What a ${scaleForSeo(data.costBand)} house in Chennai actually requires`
      : 'What house construction in Chennai actually requires',
    paragraphs: intro,
  })

  appendImageSections(sections, images)

  if (mix.length) {
    sections.push({
      type: 'highlight',
      variant: 'green',
      text: spendMixSentence(mix),
    })
    sections.push({
      type: 'comparison',
      title: 'Where house construction money went',
      items: mix.map((row) => ({
        title: row.category,
        text: `About ${row.percent}% of recorded spend. ${formatINR(row.amount)} across ${row.count} ${row.count === 1 ? 'entry' : 'entries'}.`,
        variant: COMPARISON_VARIANT[row.category] ?? 'default',
      })),
    })
  }

  if (lines.length) {
    const previewNote =
      lines.length > COST_GRID_VISIBLE_ROWS
        ? `The table opens with the first ${COST_GRID_VISIBLE_ROWS} rows so you can feel the grain of the spend. Tap Read more if you want every approved line.`
        : 'Each row is something that actually happened on this job — cement, a crew, a machine day — not just a category label.'
    sections.push({
      type: 'text',
      heading: 'House construction cost breakdown',
      paragraphs: [
        'Category and subcategory tell you the bucket. The description is the interesting part: what was bought, who worked, what the day was for.',
        previewNote,
        mix.length ? `Buckets on this job: ${mix.map((row) => row.category).join(', ')}.` : '',
      ].filter(Boolean),
    })
    sections.push({
      type: 'cost_grid',
      title: 'House construction cost — approved spend',
      rows: lines.map((row) => ({
        item: row.category,
        spec: costGridSpec(row),
        note: formatINR(row.amount),
      })),
    })
    sections.push({
      type: 'tip',
      title: 'How to use this list',
      text: 'Ask your builder for the same kind of picture — not a single lump sum, and not a pile of invoices. A house of this scale should be explainable in buckets and in plain descriptions.',
    })
  }

  if (data.stages.length) {
    sections.push({
      type: 'process',
      title: 'Construction stages for an independent house',
      tone: 'professional',
      steps: data.stages.map((stage) => `${stage} was on the recorded sequence.`),
    })
    sections.push({
      type: 'timeline',
      title: 'How long house construction takes in Chennai',
      tone: 'professional',
      steps: [
        'Foundation and plinth put the house on the ground and above the rain.',
        'Superstructure, roofing, and masonry give you rooms and a weather envelope.',
        'Electrical and plumbing go in before finishes lock the walls.',
        'Flooring and finishing make it a home. Trades often come back more than once — that is normal.',
      ],
    })
  }

  if (data.qualityAreas.length) {
    const last = data.qualityAreas[data.qualityAreas.length - 1]
    const rest = data.qualityAreas.slice(0, -1)
    const covered =
      data.qualityAreas.length === 1
        ? `We checked ${last.toLowerCase()} work while it was still open.`
        : `We checked ${rest.map((area) => area.toLowerCase()).join(', ')}, and ${last.toLowerCase()} — while those trades could still be seen.`
    sections.push({
      type: 'highlight',
      variant: 'recommend',
      text: `${covered} Ask your builder which work they look at before it gets covered up.`,
    })
  }

  if (data.scopeChangeSummary || data.additionalWorksSummary) {
    const changeBits = [
      data.additionalWorksSummary,
      data.scopeChangeSummary,
      data.scopeChangeCategories.length
        ? `The shifts we can name sat in ${data.scopeChangeCategories.map((item) => item.toLowerCase()).join(', ')}.`
        : '',
    ].filter(Boolean)
    sections.push({
      type: 'warning',
      title: 'Things moved, as they do on a house',
      text: `${changeBits.join(' ')} Write changes down. A conversation on site is easy; an unpaid extra is not.`,
    })
  }

  sections.push({
    type: 'takeaway',
    title: 'Start with the house you actually want',
    text: data.costBand
      ? `A ${data.costBand} is a different conversation from a smaller one. Size and scale first, item rates later.`
      : 'Size and scale first, item rates later. Decide the house, then argue the bag of cement.',
  })
  sections.push({
    type: 'takeaway',
    title: 'Ask where the money is going',
    text: 'Materials, labour, equipment, miscellaneous. If someone cannot talk in those buckets, they are not ready to explain a house of this scale.',
  })
  sections.push({
    type: 'takeaway',
    title: 'Keep the extras on paper',
    text: 'A wall that moves after the slab is poured costs more than a wall that moved on the drawing. That is not a lecture. It is just how houses work.',
  })

  sections.push({
    type: 'text',
    heading: 'House construction FAQs for Chennai homeowners',
    paragraphs: [
      'These are the questions people type before they call a builder. The answers come from this house — not from a rate card.',
    ],
  })
  sections.push({
    type: 'faq',
    items: seoFaqItems(data),
  })

  sections.push({
    type: 'quote',
    text: 'A useful case study feels like a conversation: here is the scale of house, here is where the money went, here is how the work moved.',
  })

  sections.push({
    type: 'cta',
    headline: 'Planning house construction in Chennai?',
    body: data.costBand
      ? `Bring the scale you have in mind — a ${data.costBand} is a real starting point — and we will talk materials versus labour, how extras are written down, and which work gets checked before it disappears behind plaster.`
      : 'Bring the scale of house you have in mind. We will talk materials versus labour, how extras are written down, and which work gets checked before it disappears behind plaster.',
    label: 'Start a conversation',
    href: '/contact',
  })

  return {
    type: 'blog',
    title,
    category: 'House construction',
    theme: 'House construction cost in Chennai',
    tagline: seoTagline(data),
    excerpt: seoExcerpt(data),
    slug: seoSlug(data),
    featured_image: images[0]?.src,
    sections,
  }
}

export function serializeVraBlogJson(post: VraBlogPost): string {
  return websiteJsonPayload(post)
}

export function isAllowedBlogSectionType(type: string): boolean {
  return (VRA_BLOG_SECTION_TYPES as readonly string[]).includes(type)
}

export function buildBlogJsonBundle(data: PublicCaseStudy): {
  blogJson: VraBlogPost
  jsonPrompt: string
  jsonText: string
} {
  const blogJson = generateVraBlogJson(data)
  const jsonPrompt = buildVraBlogJsonPrompt(
    buildBlogTopic(data),
    formatBlogImagePromptNote(data.blogImages ?? []),
  )
  return {
    blogJson,
    jsonPrompt,
    jsonText: serializeVraBlogJson(blogJson),
  }
}
