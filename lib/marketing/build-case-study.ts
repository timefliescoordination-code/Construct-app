import { bandCombinationKey } from './bands.ts'
import { buildBlogJsonBundle } from './generate-blog-json.ts'
import { generateCaseStudyMarkdown } from './generate-markdown.ts'
import { checkMarkdownPrivacy, collectForbiddenTokens } from './privacy-check.ts'
import { sanitizeProject } from './sanitize-project.ts'
import type { MarketingPortfolioItem, RawProjectInput } from './types.ts'

function longPrivateSnippet(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length >= 16 ? trimmed : null
}

export function forbiddenTokensFromProject(raw: RawProjectInput): string[] {
  return collectForbiddenTokens([
    raw.name,
    raw.clientName,
    raw.clientPhone,
    raw.clientEmail,
    raw.siteAddress,
    raw.startDate,
    raw.expectedCompletionDate,
    raw.contractValue,
    raw.proposal?.proposalNumber,
    raw.proposal?.clientName,
    raw.proposal?.clientPhone,
    raw.proposal?.clientEmail,
    raw.proposal?.projectName,
    raw.proposal?.siteAddress,
    raw.proposal?.builtUpQuantity,
    ...(raw.staffNames ?? []),
    ...(raw.contractorNames ?? []),
    ...(raw.privateSnippets ?? []),
    ...(raw.expenses ?? []).flatMap((expense) => [
      expense.vendorName,
      expense.billNumber,
    ]),
    ...(raw.additionalWorks ?? []).map((work) => longPrivateSnippet(work.description)),
    ...(raw.changeRequests ?? []).flatMap((request) => [
      request.requestNumber,
      request.title,
      request.description,
    ]),
  ])
}

export function buildMarketingDraft(raw: RawProjectInput): Omit<
  MarketingPortfolioItem,
  'recognitionRisk'
> {
  const publicData = sanitizeProject(raw)
  const markdown = generateCaseStudyMarkdown(publicData)
  const { blogJson, jsonPrompt, jsonText } = buildBlogJsonBundle(publicData)
  const forbidden = forbiddenTokensFromProject(raw)
  const allowedUrls = publicData.blogImages?.map((image) => image.src) ?? []
  const privacy = checkMarkdownPrivacy([markdown, jsonText].join('\n\n'), forbidden, {
    allowedUrls,
  })

  return {
    internalId: raw.id,
    internalName: raw.name,
    status: raw.status,
    bands: {
      size: publicData.sizeBand,
      cost: publicData.costBand,
      duration: publicData.durationBand,
    },
    markdown,
    blogJson,
    jsonPrompt,
    copySafe: privacy.ok,
    privacyIssues: privacy.issues,
    spendMix: publicData.spendMix ?? [],
    expenseSheet: publicData.expenseSheet ?? [],
    expenseLines: publicData.expenseLines ?? [],
    subcategories: publicData.subcategoriesByCategory ?? [],
  }
}

export function buildMarketingPortfolio(rawProjects: RawProjectInput[]): MarketingPortfolioItem[] {
  const drafts = rawProjects.map((raw) => buildMarketingDraft(raw))
  const keys = drafts.map((draft) => bandCombinationKey(draft.bands))
  return drafts.map((draft, index) => ({
    ...draft,
    recognitionRisk: keys.filter((key) => key === keys[index]).length <= 1 ? 'HIGH' : 'LOW',
  }))
}
