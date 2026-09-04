import type { VraBlogPost } from './blog-types.ts'

export const SIZE_BANDS = [
  'Under 1,500 sq.ft',
  '1,500–2,500 sq.ft',
  '2,500–4,000 sq.ft',
  '4,000+ sq.ft',
] as const

export type SizeBand = (typeof SIZE_BANDS)[number]

export const COST_BANDS = [
  'Under ₹50 lakh',
  '₹50–100 lakh',
  '₹100–200 lakh',
  '₹200 lakh+',
] as const

export type CostBand = (typeof COST_BANDS)[number]

export const DURATION_BANDS = [
  'Under 12 months',
  '12–18 months',
  '18–24 months',
  '24+ months',
] as const

export type DurationBand = (typeof DURATION_BANDS)[number]

export const SPEND_CATEGORIES = ['Materials', 'Labour', 'Equipment', 'Miscellaneous'] as const

export type SpendCategory = (typeof SPEND_CATEGORIES)[number]

export const STANDARD_MILESTONES = [
  'Foundation',
  'Plinth',
  'Superstructure',
  'Roofing',
  'Masonry',
  'Electrical',
  'Plumbing',
  'Flooring',
  'Finishing',
] as const

export type StandardMilestone = (typeof STANDARD_MILESTONES)[number]

export const SAFE_CHANGE_CATEGORIES = [
  'Design',
  'Material',
  'Electrical',
  'Plumbing',
  'Finishing',
  'Structural',
] as const

export type SafeChangeCategory = (typeof SAFE_CHANGE_CATEGORIES)[number]

export const SAFE_QUALITY_AREAS = [
  'Foundation',
  'Reinforcement',
  'Concrete',
  'Masonry',
  'Waterproofing',
  'Electrical',
  'Plumbing',
  'Flooring',
  'Finishing',
] as const

export type SafeQualityArea = (typeof SAFE_QUALITY_AREAS)[number]

export type PublicProposalMethod =
  | 'Quoted on a built-up-area basis'
  | 'Based on an itemized BOQ'

export type ScopeChangeSummary =
  | 'No significant scope changes recorded'
  | 'A few scope changes were recorded during construction'
  | 'Several scope changes were recorded during construction'

export type AdditionalWorksSummary =
  | 'The scope remained broadly aligned with the original quotation.'
  | 'The scope expanded during construction.'

export type RecognitionRisk = 'LOW' | 'HIGH'

export type PublicSpendShare = {
  category: SpendCategory
  percent: number
  amount: number
  count: number
}

export type PublicExpenseSheetRow = {
  category: SpendCategory
  subcategory: string | null
  percent: number
  amount: number
  count: number
}

export type PublicExpenseLineItem = {
  category: SpendCategory
  subcategory: string | null
  amount: number
}

export type PublicSubcategoryGroup = {
  category: SpendCategory
  names: string[]
}

export type PublicCaseStudy = {
  title: string
  buildingType: 'Residential construction'
  sizeBand?: SizeBand
  costBand?: CostBand
  durationBand?: DurationBand
  proposalMethod?: PublicProposalMethod
  spendMix?: PublicSpendShare[]
  expenseSheet?: PublicExpenseSheetRow[]
  expenseLines?: PublicExpenseLineItem[]
  subcategoriesByCategory?: PublicSubcategoryGroup[]
  stages: StandardMilestone[]
  qualityAreas: SafeQualityArea[]
  scopeChangeSummary?: ScopeChangeSummary
  scopeChangeCategories: SafeChangeCategory[]
  additionalWorksSummary?: AdditionalWorksSummary
}

export type RawExpenseInput = {
  amount: number
  category: string
  status: string
  vendorName?: string | null
  billNumber?: string | null
  description?: string | null
  subcategoryName?: string | null
}

export type RawChangeRequestInput = {
  category: string
  status: string
  requestNumber?: string | null
  title?: string | null
  description?: string | null
}

export type RawAdditionalWorkInput = {
  approvalStatus: string
  description?: string | null
}

export type RawProposalInput = {
  method: 'sqft' | 'boq' | null
  proposalNumber?: string | null
  builtUpQuantity?: number | null
  clientName?: string | null
  clientPhone?: string | null
  clientEmail?: string | null
  projectName?: string | null
  siteAddress?: string | null
}

export type RawProjectInput = {
  id: string
  name: string
  status: string
  clientName: string
  clientPhone?: string | null
  clientEmail?: string | null
  siteAddress: string
  contractValue: number | null
  additionalWorksValue: number | null
  startDate: string | null
  expectedCompletionDate: string | null
  milestones: Array<{ name: string }>
  expenses: RawExpenseInput[]
  additionalWorks?: RawAdditionalWorkInput[]
  changeRequests?: RawChangeRequestInput[]
  proposal?: RawProposalInput | null
  inspectionWorkTypes?: string[]
  staffNames?: string[]
  contractorNames?: string[]
  /** Raw text that must never appear in markdown (BOQ lines, custom notes, etc.). */
  privateSnippets?: string[]
}

export type PrivacyCheckResult = {
  ok: boolean
  issues: string[]
}

export type MarketingPortfolioItem = {
  internalId: string
  internalName: string
  status: string
  recognitionRisk: RecognitionRisk
  bands: {
    size?: string
    cost?: string
    duration?: string
  }
  markdown: string
  blogJson: VraBlogPost
  jsonPrompt: string
  copySafe: boolean
  privacyIssues: string[]
  spendMix: PublicSpendShare[]
  expenseSheet: PublicExpenseSheetRow[]
  expenseLines: PublicExpenseLineItem[]
  subcategories: PublicSubcategoryGroup[]
}

export const PRIVACY_CHECKLIST = [
  'Client identity removed',
  'Address removed',
  'Location removed',
  'Year removed',
  'Contract total kept as a band',
  'Exact measurements removed',
  'Photos excluded',
  'Vendors excluded',
  'Invoices excluded',
  'Proposal numbers excluded',
  'BOQ lines excluded',
  'Custom notes excluded',
] as const
