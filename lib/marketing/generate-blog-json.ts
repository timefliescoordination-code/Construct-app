import { formatINR } from '../currency.ts'
import {
  VRA_BLOG_SECTION_TYPES,
  type ComparisonVariant,
  type VraBlogPost,
  type VraBlogSection,
} from './blog-types.ts'
import type { PublicCaseStudy, PublicExpenseLineItem, PublicSpendShare } from './types.ts'
import { buildVraBlogJsonPrompt } from './vra-blog-prompt.ts'

const COMPARISON_VARIANT: Record<string, ComparisonVariant> = {
  Materials: 'info',
  Labour: 'note',
  Equipment: 'default',
  Miscellaneous: 'warning',
}

export function slugifyBlogTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.slice(0, 80) || 'vra-homes-case-study'
}

export function buildBlogTopic(data: PublicCaseStudy): string {
  const details = [data.sizeBand, data.costBand, data.durationBand].filter(Boolean)
  const detailText = details.length ? ` (${details.join(', ')})` : ''
  return `Architecture-led residential construction in Chennai: how approved spend and construction stages split on ${data.title}${detailText}. Include every approved expense row in a cost_grid. Do not name a client, street, vendor, invoice, year, or contract total.`
}

function expenseRows(data: PublicCaseStudy): PublicExpenseLineItem[] {
  if (data.expenseLines?.length) return data.expenseLines
  if (data.expenseSheet?.length) {
    return data.expenseSheet.map((row) => ({
      category: row.category,
      subcategory: row.subcategory,
      amount: row.amount,
    }))
  }
  return (data.spendMix ?? []).map((row) => ({
    category: row.category,
    subcategory: null,
    amount: row.amount,
  }))
}

function spendMixSentence(mix: PublicSpendShare[]): string {
  const largest = [...mix].sort((a, b) => b.percent - a.percent)[0]
  const parts = mix.map((row) => `${row.category.toLowerCase()} at about ${row.percent}%`)
  if (parts.length === 1) {
    return `Recorded approved spend was concentrated in ${parts[0]}.`
  }
  const last = parts.pop()
  return `The recorded mix was ${parts.join(', ')}, and ${last}. ${largest.category} took the largest share.`
}

export function generateVraBlogJson(data: PublicCaseStudy): VraBlogPost {
  const lines = expenseRows(data)
  const mix = data.spendMix ?? []
  const sections: VraBlogSection[] = []

  sections.push({
    type: 'hero',
    eyebrow: 'VRA Homes case study',
    title: data.title,
    subtitle:
      'A Chennai residential build, described in public bands and approved expense rows — not as a named house.',
  })

  const stats = [
    data.sizeBand ? { label: 'Size band', value: data.sizeBand } : null,
    data.costBand ? { label: 'Cost band', value: data.costBand } : null,
    data.durationBand ? { label: 'Duration band', value: data.durationBand } : null,
    data.proposalMethod ? { label: 'Quotation method', value: data.proposalMethod } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item))
  if (stats.length) {
    sections.push({ type: 'stats', items: stats })
  }

  sections.push({
    type: 'highlight',
    variant: 'note',
    text: 'No client name, address, calendar year, vendor, invoice, or contract total appears in this post. Those details stay in the project file.',
  })

  const intro: string[] = [
    `${data.title} is a residential construction case study from VRA Homes' Chennai practice. The point is pattern: where money sat, which stages were recorded, and what a homeowner can ask before drawings turn into a site.`,
  ]
  if (data.sizeBand && data.costBand) {
    intro.push(
      `This home sat in the ${data.sizeBand} size band and the ${data.costBand} public cost band. Those ranges are wide on purpose.`,
    )
  } else if (data.costBand) {
    intro.push(`The overall project sat in the ${data.costBand} public cost band.`)
  } else if (data.sizeBand) {
    intro.push(`The home sat in the ${data.sizeBand} size band.`)
  }
  if (data.durationBand) {
    intro.push(
      `Construction spanned the ${data.durationBand} window. That is a span between recorded start and completion information, not a delay diary.`,
    )
  }
  if (data.proposalMethod) {
    intro.push(
      `The original quotation method was ${data.proposalMethod.toLowerCase()}. Method is a label. Line rates are not published.`,
    )
  }
  sections.push({
    type: 'text',
    heading: 'What this post is — and is not',
    paragraphs: intro,
  })

  if (mix.length) {
    sections.push({
      type: 'highlight',
      variant: 'green',
      text: spendMixSentence(mix),
    })
    sections.push({
      type: 'comparison',
      title: 'Approved spend, in four public buckets',
      items: mix.map((row) => ({
        title: row.category,
        text: `About ${row.percent}% of recorded approved spend. ${formatINR(row.amount)} across ${row.count} ${row.count === 1 ? 'entry' : 'entries'}.`,
        variant: COMPARISON_VARIANT[row.category] ?? 'default',
      })),
    })
  }

  if (lines.length) {
    sections.push({
      type: 'text',
      heading: 'Every approved expense row',
      paragraphs: [
        'The grid below lists each approved expense as it was grouped on the project expenses tab: category, subcategory or team, and amount. Vendor names, invoice numbers, and dates are omitted.',
        mix.length
          ? `Categories recorded: ${mix.map((row) => row.category).join(', ')}.`
          : 'Categories with no supporting records are omitted rather than filled with guesses.',
      ],
    })
    sections.push({
      type: 'cost_grid',
      title: 'Approved expense rows',
      rows: lines.map((row) => ({
        item: row.category,
        spec: row.subcategory ?? '',
        note: formatINR(row.amount),
      })),
    })
    sections.push({
      type: 'tip',
      title: 'How to read the grid',
      text: 'Use it to see where attention went, not to reverse-engineer a supplier bill. The overall contract figure remains a public band only.',
    })
  }

  if (data.stages.length) {
    sections.push({
      type: 'process',
      title: 'Documented construction stages',
      tone: 'professional',
      steps: data.stages.map((stage) => `${stage} was among the recorded stages.`),
    })
    sections.push({
      type: 'timeline',
      title: 'A typical house still moves from ground to finish',
      tone: 'professional',
      steps: [
        'Foundation and plinth set the house on the ground and above surface water.',
        'Superstructure, roofing, and masonry give the home its rooms and weather envelope.',
        'Electrical and plumbing are coordinated before finishes lock the walls.',
        'Flooring and finishing make the house usable. Trades often return more than once.',
      ],
    })
  }

  if (data.qualityAreas.length) {
    const last = data.qualityAreas[data.qualityAreas.length - 1]
    const rest = data.qualityAreas.slice(0, -1)
    const covered =
      data.qualityAreas.length === 1
        ? `Quality checks covered ${last.toLowerCase()} work.`
        : `Quality checks covered ${rest.map((area) => area.toLowerCase()).join(', ')}, and ${last.toLowerCase()}.`
    sections.push({
      type: 'highlight',
      variant: 'recommend',
      text: `${covered} Those labels are work types, not a punch-list and not a pass-fail report.`,
    })
  }

  if (data.scopeChangeSummary || data.additionalWorksSummary) {
    const changeBits = [
      data.additionalWorksSummary,
      data.scopeChangeSummary,
      data.scopeChangeCategories.length
        ? `Where a category could be stated safely, it related to ${data.scopeChangeCategories.map((item) => item.toLowerCase()).join(', ')} work.`
        : '',
    ].filter(Boolean)
    sections.push({
      type: 'warning',
      title: 'Changes during construction',
      text: `${changeBits.join(' ')} Exact change titles and rupee values stay out of this post.`,
    })
  }

  sections.push({
    type: 'takeaway',
    title: 'Plan with bands first',
    text: 'Decide whether the home is compact, mid-size, or large, and whether the budget sits in a broad lakh range, before arguing over individual item rates.',
  })
  sections.push({
    type: 'takeaway',
    title: 'Ask for a four-bucket mix',
    text: 'Materials, labour, equipment, and miscellaneous. If a builder cannot explain the mix without reading invoice numbers aloud, the reporting is too fine-grained for a first conversation.',
  })
  sections.push({
    type: 'takeaway',
    title: 'Keep changes in writing',
    text: 'Scope that grows is not automatically a failure. Undocumented growth is how trust is lost.',
  })

  sections.push({
    type: 'faq',
    items: [
      {
        q: 'Why is the overall contract value hidden?',
        a: 'The full contract figure can identify a household or a negotiated rate. A public lakh band still shows scale. Approved expense rows are listed with category, subcategory, and amount. Vendor bills and invoice numbers are not.',
      },
      {
        q: 'What does a built-up area band mean?',
        a: 'It is a range, not a survey measurement. It tells you whether the home is compact, mid-size, large, or very large. It is not a substitute for drawings, and it is not a claim about plot size.',
      },
      {
        q: 'Can this article be used as a quotation?',
        a: 'No. It is an educational case study. A quotation still needs a method, a specification, and a private commercial review.',
      },
      {
        q: 'What should a Chennai homeowner ask after reading this?',
        a: 'Ask which size band the design sits in, which cost band they are targeting, how they expect materials and labour to share the spend, and which standard stages they will report against. Ask them not to put your address, phone, or agreement number into public pages.',
      },
    ],
  })

  sections.push({
    type: 'quote',
    text: 'A useful case study teaches structure: size in bands, cost in bands, time in bands, spend in public buckets, and work in standard stages.',
  })

  sections.push({
    type: 'cta',
    headline: 'Planning a home in Chennai?',
    body: 'Bring a size band, a cost band, and the construction window you can support. We will talk materials versus labour, how changes are written down, and which work types are checked before they are covered up.',
    label: 'Start a conversation',
    href: '/contact',
  })

  const details = [data.sizeBand, data.costBand, data.durationBand].filter(Boolean).join(' · ')
  return {
    type: 'blog',
    title: `${data.title}: how a Chennai home actually spent`,
    category: 'Case Study',
    theme: 'Residential construction',
    tagline: details || 'Architecture-led residential construction in Chennai',
    excerpt: `${data.title} mapped into public size, cost, and duration bands, with every approved expense row listed by category. Client identity, vendors, and the contract total stay out.`,
    slug: slugifyBlogTitle(`${data.title} chennai spend stages`),
    sections,
  }
}

export function serializeVraBlogJson(post: VraBlogPost): string {
  return `${JSON.stringify(post, null, 2)}\n`
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
  const jsonPrompt = buildVraBlogJsonPrompt(buildBlogTopic(data))
  return {
    blogJson,
    jsonPrompt,
    jsonText: serializeVraBlogJson(blogJson),
  }
}
