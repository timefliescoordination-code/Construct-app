import type { PublicCaseStudy, PublicSpendShare, SafeChangeCategory, SafeQualityArea, StandardMilestone } from './types.ts'

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
  if (data.sizeBand) bullets.push(`- Approximate size band: ${data.sizeBand}`)
  if (data.costBand) bullets.push(`- Approximate cost band: ${data.costBand}`)
  if (data.durationBand) bullets.push(`- Approximate construction duration: ${data.durationBand}`)
  if (data.proposalMethod) bullets.push(`- Quotation method: ${data.proposalMethod}`)
  return bullets
}

function expenseTable(mix: PublicSpendShare[]): string {
  const rows = mix.map((row) => `| ${row.category} | ${row.percent}% |`).join('\n')
  return `| Category | Approximate Share |\n|---|---:|\n${rows}`
}

function genericCostEducation(): string {
  return [
    'Home construction spending is easier to understand when it is grouped into a few broad buckets rather than a long list of purchases.',
    'In general terms, materials cover the goods that become part of the building: items such as cementitious products, reinforcement steel, masonry units, sand, aggregates, tiles, sanitaryware, cables, and finishes.',
    'Labour covers the people who convert those goods into a finished structure, including skilled trades and support workers on site.',
    'Equipment covers machinery and tools that are hired or used to move, mix, lift, or compact work, rather than items that remain in the building.',
    'Miscellaneous covers supporting costs that do not fit the first three groups, such as transport, statutory charges, temporary facilities, and small incidental purchases.',
    'These groups are educational categories. They are not a full chart of accounts, and they are not a promise that every home will split in the same way.',
    'A useful planning habit is to treat the largest group as the one that needs the most procurement discipline, while still reserving attention for labour productivity and equipment hire periods.',
    'Homeowners often focus only on quoted material rates. In practice, waste, rework, access constraints, and idle time can move the mix even when the original specification stays the same.',
    'Publishing exact rupee amounts for a single house can identify the client, the contractor, or the site. Banded figures and rounded shares avoid that problem while still showing how money tends to be distributed.',
    'The figures in this article are rounded to coarse increments so that they cannot be reverse-engineered into invoices, vendor bills, or a contract total.',
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
    'Not every project records every stage in the same way. This article only describes stages that could be mapped to a standard catalogue. Custom stage names are omitted on purpose.',
    'A homeowner reading this as planning advice should still expect overlap. Trades often return to a area more than once, and finishing work can start in one wing while structure continues in another.',
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
    'This article does not report pass or fail outcomes, inspector names, photographs, or pin-level site locations. Those details can identify a property and are omitted.',
    'Homeowners can still ask useful questions: which trades are checked, when checks happen relative to covering-up, and how corrections are closed before the next stage starts.',
  ]
  if (areas.length) {
    paragraphs.push(
      `${qualitySentence(areas)} Those labels are taken from a standard work catalogue. They are not a punch-list and they do not describe defects.`,
    )
  }
  paragraphs.push(
    'A practical takeaway is to keep quality discussion at the level of work types, not at the level of named people, file names, or street-level locations.',
  )
  return paragraphs.join('\n\n')
}

function genericChangeEducation(data: PublicCaseStudy): string {
  const paragraphs = [
    'Almost every house evolves a little between the first quotation and handover. The important public question is whether the overall scope stayed close to the original bargain or grew.',
    data.additionalWorksSummary ?? '',
    data.scopeChangeSummary ?? '',
    changeCategorySentence(data.scopeChangeCategories),
    'Exact change titles, messages, request numbers, and rupee values are omitted. Those fields are unique to a client conversation and do not belong in a marketing article.',
    'As general advice, homeowners should expect that moving a wall, upgrading a finish, or adding a service run after work has started will cost more than deciding it on paper. Recording changes in writing, with a clear yes or no, keeps the relationship clearer than informal site instructions.',
    'A small number of recorded changes is not automatically a problem. A large number can still be healthy if each one is priced and accepted. This article only states how many significant records existed, in coarse language.',
  ]
  return paragraphs.filter(Boolean).join('\n\n')
}

function lessons(data: PublicCaseStudy): string {
  const lines: string[] = [
    'The public value of a case study like this is pattern, not gossip. Readers can see how a residential project can be described without naming a family, a street, or a contract.',
  ]
  if (data.spendMix?.length) {
    lines.push(spendSentence(data.spendMix))
    lines.push(
      'That mix is a planning hint, not a quote. A different specification, access condition, or labour market can move the shares even inside the same size and cost bands.',
    )
  }
  if (data.sizeBand) {
    lines.push(
      `The approximate size sat in the ${data.sizeBand} band. Size affects material quantities, scaffolding, and the number of people who can work productively at once, but it is not a substitute for a specification.`,
    )
  }
  if (data.costBand) {
    lines.push(
      `The approximate contract scale sat in the ${data.costBand} band. Cost bands are wide on purpose so that a single house cannot be picked out of a local market by its published price.`,
    )
  }
  if (data.durationBand) {
    lines.push(
      `The construction window sat in the ${data.durationBand} band. Duration here is a span between recorded start and completion information, not a diary of delays, monsoon days, or handover ceremonies.`,
    )
  }
  if (data.proposalMethod) {
    lines.push(
      `The original quotation approach was: ${data.proposalMethod.toLowerCase()}. That is a method label only. Line-by-line quantities and rates are not published.`,
    )
  }
  if (data.stages.length) {
    lines.push(stageSentence(data.stages))
  }
  lines.push(
    'Nothing in this section should be read as a client testimonial, a guarantee of margin, or a claim about a neighbourhood. It is a sanitized reading of project records that survived privacy rules.',
  )
  return lines.join('\n\n')
}

function takeaways(): string {
  return [
    'Plan with bands first. Decide whether the home is small, mid-size, or large, and whether the budget sits in a broad lakh range, before arguing over individual item rates.',
    'Ask for a spend mix in the same four public categories used here: materials, labour, equipment, and miscellaneous. If a builder cannot explain the mix without reading invoice numbers aloud, the reporting is too fine-grained for a first conversation.',
    'Treat duration as a range. A house that can be described only as “finished in a named month” is being described too precisely for public discussion.',
    'Keep changes in writing. Scope that grows is not automatically a failure, but undocumented growth is how trust is lost.',
    'Talk about quality as work types: foundation, reinforcement, concrete, masonry, waterproofing, electrical, and plumbing. Avoid circulating site photographs or inspector notes in public marketing.',
    'Do not publish exact built-up area, exact contract value, or vendor names. Those details help operations; they do not help a future homeowner understand the shape of a typical build.',
    'If two published case studies would look identical after banding, that is a feature. Unique combinations of size, cost, and duration can still identify a house, which is why an internal recognition warning exists for administrators.',
  ]
    .map((line, index) => `${index + 1}. ${line}`)
    .join('\n')
}

function faqs(): string {
  const items: Array<[string, string]> = [
    [
      'Why are exact costs hidden?',
      'Exact rupee figures can identify a household, a contractor relationship, or a negotiated rate. Coarse bands still help a reader understand scale without turning a private contract into a public price list.',
    ],
    [
      'What does a built-up area band mean?',
      'It is a range, not a survey measurement. It tells you whether the home is compact, mid-size, large, or very large. It is not a substitute for drawings, and it is not a claim about plot size.',
    ],
    [
      'Why round expense shares to steps of five percent?',
      'Fine percentages can be reversed into invoice totals when someone already knows one bill. Five-percent steps are coarse enough to describe mix and blunt enough to protect suppliers and clients.',
    ],
    [
      'Does a longer duration band mean the job was delayed?',
      'No. The public duration is only a span derived from recorded start and completion information. It does not say why the span was that long, and it does not name weather, labour, or approval events.',
    ],
    [
      'Why are custom milestone names removed?',
      'Custom names often include client nicknames, wing labels, or interior packages that are unique to one house. Only stages that map to a standard catalogue are safe to repeat in public.',
    ],
    [
      'Can this article be used as a quotation?',
      'No. It is an educational case study. A quotation still needs a method, a specification, and a private commercial review. Nothing here is a rate, a discount, or an offer.',
    ],
    [
      'What should a homeowner ask a builder after reading this?',
      'Ask which size band they believe the design sits in, which cost band they are targeting, how they expect materials and labour to share the spend, and which standard stages they will report against. Ask them not to put your address, phone, or agreement number into public pages.',
    ],
  ]

  return items
    .map(([question, answer]) => `### ${question}\n\n${answer}`)
    .join('\n\n')
}

function conclusion(): string {
  return [
    'A construction case study is most useful when it teaches structure: size in bands, cost in bands, time in bands, spend in round shares, and work in standard stages.',
    'If you are planning a similar home, speak with a qualified construction team about your intended built-up area, a realistic budget range, and the construction window you can support. Bring questions about materials versus labour, about how changes will be written down, and about which work types will be checked before they are covered up.',
    'Keep private records private. Share only the kind of coarse, catalogue-based picture this article uses.',
  ].join('\n\n')
}

export function generateCaseStudyMarkdown(data: PublicCaseStudy): string {
  const sections: string[] = []

  sections.push(`# ${data.title}`)
  sections.push(
    'A completed residential construction project that provides useful insight into how construction costs and work stages can be distributed across a typical home-building project.',
  )

  sections.push('## Project Overview')
  sections.push(
    [
      'The overview below uses only coarse public labels. It does not name a client, a site, or a calendar date.',
      overviewBullets(data).join('\n'),
    ].join('\n\n'),
  )

  sections.push('## Understanding the Construction Cost')
  const costIntro: string[] = []
  if (data.costBand) {
    costIntro.push(
      `The overall project sat in the ${data.costBand} public cost band. That band is the only cost figure this article will use.`,
    )
  }
  if (data.sizeBand) {
    costIntro.push(`The home sat in the ${data.sizeBand} size band.`)
  }
  if (data.durationBand) {
    costIntro.push(`Construction spanned the ${data.durationBand} duration band.`)
  }
  if (data.spendMix?.length) {
    costIntro.push(spendSentence(data.spendMix))
  }
  costIntro.push(genericCostEducation())
  sections.push(costIntro.filter(Boolean).join('\n\n'))

  if (data.spendMix?.length) {
    sections.push('## Expense Distribution')
    sections.push(
      [
        'The table uses approved project expenses only, rolled into four public categories. Individual bills, vendors, and dates are not shown. Percentages are rounded to the nearest five percent and forced to total one hundred percent.',
        expenseTable(data.spendMix),
        'Categories with no supporting records are omitted rather than filled with guesses.',
      ].join('\n\n'),
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
      'These points are general planning advice for homeowners. They are not a claim about a named family, a named site, or a named contractor.',
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
