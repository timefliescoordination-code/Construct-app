import { formatINR } from '../currency.ts'
import { COST_GRID_VISIBLE_ROWS } from './blog-limits.ts'
import { EXPENSE_DISTRIBUTION_HEADING } from './split-case-study.ts'
import type {
  PublicCaseStudy,
  PublicExpenseLineItem,
  PublicSpendShare,
  PublicSubcategoryGroup,
  SafeChangeCategory,
  SafeQualityArea,
  StandardMilestone,
} from './types.ts'

function hasSufficientData(data: PublicCaseStudy): boolean {
  const bandCount = [data.sizeBand, data.costBand, data.durationBand].filter(Boolean).length
  return Boolean(data.spendMix?.length) || bandCount >= 2 || data.stages.length >= 3
}

function spendSentence(mix: PublicSpendShare[]): string {
  const largest = [...mix].sort((a, b) => b.percent - a.percent)[0]
  const parts = mix.map((row) => `${row.category.toLowerCase()} at about ${row.percent}%`)
  if (parts.length === 1) {
    return `Recorded spend was concentrated in ${parts[0]}.`
  }
  const last = parts.pop()
  return `The recorded spend mix was ${parts.join(', ')}, and ${last}. ${largest.category} formed the largest share.`
}

function stageSentence(stages: StandardMilestone[]): string {
  if (stages.length === 1) return `The documented construction stage was ${stages[0].toLowerCase()}.`
  if (stages.length === 2) {
    return `Documented stages included ${stages[0].toLowerCase()} and ${stages[1].toLowerCase()}.`
  }
  const last = stages[stages.length - 1]
  const rest = stages.slice(0, -1).map((stage) => stage.toLowerCase())
  return `Documented stages included ${rest.join(', ')}, and ${last.toLowerCase()}.`
}

function qualitySentence(areas: SafeQualityArea[]): string {
  if (!areas.length) return ''
  if (areas.length === 1) {
    return `Quality checks covered ${areas[0].toLowerCase()} work.`
  }
  const last = areas[areas.length - 1]
  const rest = areas.slice(0, -1).map((area) => area.toLowerCase())
  return `Quality checks covered areas such as ${rest.join(', ')}, and ${last.toLowerCase()}.`
}

function changeCategorySentence(categories: SafeChangeCategory[]): string {
  if (!categories.length) return ''
  if (categories.length === 1) {
    return `Where a category could be stated safely, it related to ${categories[0].toLowerCase()} work.`
  }
  const last = categories[categories.length - 1]
  const rest = categories.slice(0, -1).map((item) => item.toLowerCase())
  return `Where categories could be stated safely, they related to ${rest.join(', ')}, and ${last.toLowerCase()} work.`
}

function overviewBullets(data: PublicCaseStudy): string[] {
  const bullets = [`- Building type: ${data.buildingType}`]
  if (data.sizeBand) bullets.push(`- Size: ${data.sizeBand}`)
  if (data.costBand) bullets.push(`- This home: ${data.costBand}`)
  if (data.durationBand) bullets.push(`- On site: ${data.durationBand}`)
  if (data.proposalMethod) bullets.push(`- Quotation method: ${data.proposalMethod}`)
  return bullets
}

function categoriesRecordedLine(mix: PublicSpendShare[]): string {
  return `Categories recorded: ${mix.map((row) => row.category).join(', ')}.`
}

function subcategoriesRecordedLine(groups: PublicSubcategoryGroup[] | undefined): string | null {
  const names = (groups ?? []).flatMap((group) => group.names)
  if (!names.length) return null
  return `Subcategories recorded: ${names.join(', ')}.`
}

function expenseLineTable(lines: PublicExpenseLineItem[]): string {
  const preview = lines.slice(0, COST_GRID_VISIBLE_ROWS)
  const rows = preview
    .map(
      (row) =>
        `| ${row.category} | ${row.subcategory ?? ''} | ${row.description ?? ''} | ${formatINR(row.amount)} |`,
    )
    .join('\n')
  const heading =
    '| Category | Subcategory | Description | Amount |\n|---|---|---|---:|\n'
  const more =
    lines.length > COST_GRID_VISIBLE_ROWS
      ? `\n\nThose are the first ${COST_GRID_VISIBLE_ROWS} rows. Open Read more on the blog preview if you want every approved line.`
      : ''
  return `${heading}${rows}${more}`
}

function genericCostEducation(): string {
  return [
    'If you are about to build, the useful picture is not a single lump sum. It is where the money goes while a house of this scale is standing up.',
    'Materials are the things that stay in the building: cement, steel, blocks, sand, tiles, sanitaryware, cables, paint. Labour is the people who turn those things into rooms. Equipment is the mixer, the lift, the compactors — hired for a stretch, then gone. Miscellaneous is the rest: transport, temporary sheds, small site needs.',
    'These four buckets are how we talk to a new homeowner. They are not a full accounts book, and they are not a promise that your house will split the same way.',
    'The largest bucket is usually where procurement discipline matters most. Labour still needs watching: idle days cost as surely as a dear bag of cement. Equipment hire looks cheap until it sits unused in the rain.',
    'People often shop only for material rates. Waste, rework, a tight plot, and waiting for the next trade will move the mix even when the drawing stays the same.',
    'The table lists approved spend with a category, a subcategory or team, and a short description of what the line was for. That description is the interesting part. A house of this scale should be explainable that way.',
    'Use the list to feel the grain of the job. Ask your builder for the same kind of picture before you compare quotations.',
    'A mid-size Chennai house spends a lot of its life waiting: for concrete to gain strength, for a specialist, for a drawing clarification. That waiting is part of the cost of a house this size, even when nobody is pouring on that particular morning.',
    'If two quotations look identical as a lump sum and wildly different once you open the buckets, believe the buckets. The lump sum is a handshake. The list is the work.',
    'Steel and cement will always look large. Finishing looks small until it is not — tiles, carpentry, and paint have a way of arriving late and loudly. Leave room in your head for that.',
    'Equipment is easy to forget at the dining table and expensive to forget on site. A mixer sitting idle is still a mixer you are paying for.',
  ].join('\n\n')
}

function genericStageEducation(stages: StandardMilestone[]): string {
  const extras: string[] = [
    'Residential construction usually proceeds from the ground up. Early work establishes a stable base. Later work closes the building envelope and then fits out interiors.',
    'Foundation work creates the interface between soil and structure. Getting this stage right reduces settlement risk for everything that follows.',
    'Plinth work raises the occupied level above surrounding ground and helps keep moisture and surface water away from the habitable floors.',
    'Superstructure work forms the frame that carries floors, walls, and the roof. It is the stage where the building first becomes three-dimensional.',
    'Roofing closes the top of the structure and is a major step toward weather protection.',
    'Masonry fills and stiffens the frame, defining rooms and external walls.',
    'Electrical and plumbing work are typically coordinated before finishes lock the walls and floors, so that concealed services can be tested.',
    'Flooring and finishing make the house usable: walking surfaces, openings, paint, and the last protective layers.',
    'Not every project records every stage in the same way. This article only names stages that map to a simple catalogue: foundation through finishing. Nicknames for a wing or a lounge do not help a future homeowner.',
    'A homeowner reading this as planning advice should still expect overlap. Trades often return to an area more than once, and finishing work can start in one wing while structure continues in another. That is a house being built, not a factory line.',
  ]

  if (stages.includes('Foundation') || stages.includes('Plinth')) {
    extras.push(
      'For this case study, early structural stages were among the documented work. That is consistent with a complete house-building sequence rather than a interiors-only fit-out.',
    )
  }
  if (stages.includes('Electrical') || stages.includes('Plumbing')) {
    extras.push(
      'Documented services stages indicate that concealed electrical or plumbing work was part of the recorded sequence, which is typical for a full residential build.',
    )
  }
  if (stages.includes('Finishing') || stages.includes('Flooring')) {
    extras.push(
      'Documented finishing or flooring stages suggest the project was taken through to habitable interiors, not stopped at structure.',
    )
  }

  return extras.join('\n\n')
}

function genericQualityEducation(areas: SafeQualityArea[]): string {
  const paragraphs = [
    'Quality management on a house site is less about a single inspection event and more about repeating checks while work is still accessible.',
    'Typical checks look at whether the right materials arrived, whether setting-out matches the intended layout, and whether cover, alignment, curing, falls, and fixings meet a written standard.',
    'Ask which trades are checked, when those checks happen relative to covering-up, and how a correction is closed before the next stage starts. Those are homeowner questions. They do not need a punch-list in public.',
  ]
  if (areas.length) {
    paragraphs.push(
      `${qualitySentence(areas)} Those labels are taken from a standard work catalogue. They are not a punch-list and they do not describe defects.`,
    )
  }
  paragraphs.push(
    'A practical takeaway is to keep quality talk at the level of work types — foundation, waterproofing, electrical — so you know what was looked at before it disappeared behind plaster.',
  )
  return paragraphs.join('\n\n')
}

function genericChangeEducation(data: PublicCaseStudy): string {
  const paragraphs = [
    'Almost every house evolves a little between the first quotation and handover. The important public question is whether the overall scope stayed close to the original bargain or grew.',
    data.additionalWorksSummary ?? '',
    data.scopeChangeSummary ?? '',
    changeCategorySentence(data.scopeChangeCategories),
    'As general advice, homeowners should expect that moving a wall, upgrading a finish, or adding a service run after work has started will cost more than deciding it on paper. Recording changes in writing, with a clear yes or no, keeps the relationship clearer than a wave of the hand on site.',
    'A small number of recorded changes is not automatically a problem. A large number can still be healthy if each one is priced and accepted. This article only says, in coarse language, how much the scope moved.',
  ]
  return paragraphs.filter(Boolean).join('\n\n')
}

function lessons(data: PublicCaseStudy): string {
  const lines: string[] = [
    'The public value of a case study like this is pattern, not gossip. You should leave with a feel for the scale of house, where the money sat, and how the work moved.',
  ]
  if (data.spendMix?.length) {
    lines.push(spendSentence(data.spendMix))
    lines.push(
      'That mix is a planning hint, not a quote. A different specification, a tight plot, or a different labour market can move the shares even inside the same size of home.',
    )
  }
  if (data.sizeBand) {
    lines.push(
      `The home sat in the ${data.sizeBand} size. Size affects material quantities, scaffolding, and how many people can work productively at once. It is not a substitute for a drawing.`,
    )
  }
  if (data.costBand) {
    lines.push(
      `This was a ${data.costBand}. That figure is rounded so you can picture the scale — not a 1 Cr to 2 Cr range, and not a lakh ladder that nobody in Chennai actually speaks in.`,
    )
  }
  if (data.durationBand) {
    lines.push(
      `Work ran for ${data.durationBand}. That is a span of construction, not a diary of delays or a monsoon report.`,
    )
  }
  if (data.proposalMethod) {
    lines.push(
      `The original quotation was ${data.proposalMethod.toLowerCase()}. That is how the first conversation was structured. Line rates are a private later step.`,
    )
  }
  if (data.stages.length) {
    lines.push(stageSentence(data.stages))
  }
  lines.push(
    'Nothing here is a testimonial, a guaranteed margin, or a claim about a neighbourhood. It is one house, read for a future homeowner.',
  )
  return lines.join('\n\n')
}

function takeaways(): string {
  return [
    'Start with the house you actually want. A 1.2 Cr residence is a different conversation from a smaller one. Scale first, item rates later.',
    'Ask where the money is going — materials, labour, equipment, miscellaneous — and ask for descriptions, not only category names. A house of this scale should be explainable that way.',
    'Treat duration as a span of work, not a calendar date on a banner. Houses take the time they take.',
    'Keep extras on paper. Scope that grows is not automatically a failure. Undocumented growth is how trust thins out.',
    'Talk about quality as work types: foundation, reinforcement, concrete, masonry, waterproofing, electrical, plumbing. Ask what gets checked before it is covered up.',
    'If you are comparing builders, ask each of them to walk you through a job of similar scale. The conversation will tell you more than a single number on a quotation.',
    'Two published houses can look alike at this altitude, and that is fine. You are here to learn the shape of a build, not to identify a neighbour.',
  ]
    .map((line, index) => `${index + 1}. ${line}`)
    .join('\n')
}

function faqs(): string {
  const items: Array<[string, string]> = [
    [
      'What should a new homeowner take from this?',
      'A feel for what a house of this scale requires: the mix of materials and people, the sequence of work, and a spend list you can actually read. Category and subcategory are the buckets. The description is what happened.',
    ],
    [
      'What does a built-up size band mean?',
      'It is a range, not a survey measurement. It tells you whether the home is compact, mid-size, large, or very large. It is not a substitute for drawings, and it is not a claim about plot size.',
    ],
    [
      'Why round the spend mix to steps of five percent?',
      'The mix is a coarse reading of share so you can see the shape at a glance. The rupee column next to it is the approved total for that bucket. Together they are enough to plan with.',
    ],
    [
      'Does a longer duration mean the job was delayed?',
      'Not by itself. Duration here is a span of construction. It does not name weather, labour, or approval events, and it is not a scorecard.',
    ],
    [
      'How do you talk about stages?',
      'In the language a homeowner already knows: foundation, plinth, superstructure, roofing, masonry, electrical, plumbing, flooring, finishing. That is enough to follow the job.',
    ],
    [
      'Can this article be used as a quotation?',
      'No. It is one house, already built. A quotation still needs a method, a specification, and a conversation about your plot. Nothing here is a rate, a discount, or an offer.',
    ],
    [
      'What should I ask a builder after reading this?',
      'Walk me through materials versus labour at this scale. Show me a spend list with descriptions, not only category names. Tell me which stages you will report, and how extras get written down.',
    ],
  ]

  return items
    .map(([question, answer]) => `### ${question}\n\n${answer}`)
    .join('\n\n')
}

function conclusion(): string {
  return [
    'A construction case study is most useful when it feels like a conversation: here is the scale of house, here is where the money went, here is how the work moved.',
    'If you are planning a similar home, sit with a team about the built-up size you have in mind, a realistic Crore figure, and the construction window you can support. Bring questions about materials versus labour, about how changes will be written down, and about which work types will be checked before they are covered up.',
    'That is what a new homeowner needs from a house of this scale. The rest is your drawing, your plot, and the people you trust to build it.',
  ].join('\n\n')
}

export function generateCaseStudyMarkdown(data: PublicCaseStudy): string {
  const sections: string[] = []

  sections.push(`# ${data.title}`)
  sections.push(
    data.costBand
      ? `A ${data.costBand}. For a new homeowner, this is what a project of this scale actually required — materials, people, machines, and the sequence of work.`
      : 'A Chennai home. For a new homeowner, this is what a project of this scale actually required — materials, people, machines, and the sequence of work.',
  )

  sections.push('## Project Overview')
  sections.push(
    [
      'Here is the scale of the house, in the language we actually speak.',
      overviewBullets(data).join('\n'),
    ].join('\n\n'),
  )

  sections.push('## Understanding the Construction Cost')
  const costIntro: string[] = []
  if (data.costBand) {
    costIntro.push(`This was a ${data.costBand}.`)
  }
  if (data.sizeBand) {
    costIntro.push(`The home sat in the ${data.sizeBand} size.`)
  }
  if (data.durationBand) {
    costIntro.push(`Work ran for ${data.durationBand}.`)
  }
  if (data.spendMix?.length) {
    costIntro.push(spendSentence(data.spendMix))
  }
  costIntro.push(genericCostEducation())
  sections.push(costIntro.filter(Boolean).join('\n\n'))

  if (data.spendMix?.length) {
    const lines =
      data.expenseLines?.length
        ? data.expenseLines
        : data.expenseSheet?.length
          ? data.expenseSheet.map((row) => ({
              category: row.category,
              subcategory: row.subcategory,
              description: null,
              amount: row.amount,
            }))
          : data.spendMix.map((row) => ({
              category: row.category,
              subcategory: null,
              description: null,
              amount: row.amount,
            }))
    const subcategoryLine = subcategoriesRecordedLine(data.subcategoriesByCategory)
    sections.push(EXPENSE_DISTRIBUTION_HEADING)
    sections.push(
      [
        'Category and subcategory are the buckets. The description is what the line was for. The first thirty rows are in the table; Read more on the blog preview opens the rest if there are more.',
        categoriesRecordedLine(data.spendMix),
        subcategoryLine,
        expenseLineTable(lines),
        'Buckets with nothing recorded are left out rather than invented.',
      ]
        .filter((block): block is string => Boolean(block))
        .join('\n\n'),
    )
  }

  if (data.stages.length) {
    sections.push('## Construction Stages')
    sections.push(
      [stageSentence(data.stages), genericStageEducation(data.stages)].join('\n\n'),
    )
  }

  if (data.qualityAreas.length) {
    sections.push('## Quality Management')
    sections.push(genericQualityEducation(data.qualityAreas))
  }

  if (data.additionalWorksSummary || data.scopeChangeSummary) {
    sections.push('## Changes During Construction')
    sections.push(genericChangeEducation(data))
  }

  sections.push('## What This Project Shows')
  sections.push(lessons(data))

  sections.push('## Key Takeaways')
  sections.push(
    [
      'These points are for someone about to build. They are not a claim about a named family or a named site.',
      takeaways(),
    ].join('\n\n'),
  )

  if (hasSufficientData(data)) {
    sections.push('## Frequently Asked Questions')
    sections.push(faqs())
  }

  sections.push('## Conclusion')
  sections.push(conclusion())

  return sections.join('\n\n').trim() + '\n'
}

export function countWords(markdown: string): number {
  return markdown
    .replace(/[|#*_`]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}
