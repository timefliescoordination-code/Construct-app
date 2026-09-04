import { STANDARD_MILESTONES, type StandardMilestone } from './types.ts'

function normalizeMilestoneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type MilestoneRule = {
  publicName: StandardMilestone
  patterns: RegExp[]
}

const MILESTONE_RULES: MilestoneRule[] = [
  { publicName: 'Foundation', patterns: [/\bfoundation\b/, /\bfooting\b/, /\bpile\b/] },
  { publicName: 'Plinth', patterns: [/\bplinth\b/] },
  {
    publicName: 'Superstructure',
    patterns: [/\bsuperstructure\b/, /\bcolumn\b/, /\bbeam\b/, /\brcc frame\b/],
  },
  { publicName: 'Roofing', patterns: [/\broofing\b/, /\broof slab\b/, /\broof work\b/, /\broof\b/] },
  { publicName: 'Masonry', patterns: [/\bmasonry\b/, /\bbrick/, /\bblock work\b/] },
  { publicName: 'Electrical', patterns: [/\belectrical\b/, /\bwiring\b/] },
  { publicName: 'Plumbing', patterns: [/\bplumbing\b/, /\bsanitary\b/] },
  { publicName: 'Flooring', patterns: [/\bflooring\b/, /\btiling\b/, /\btile\b/] },
  {
    publicName: 'Finishing',
    patterns: [/\bfinishing\b/, /\bplaster/, /\bpaint/, /\bwoodwork\b/],
  },
]

export function mapMilestoneName(name: string): StandardMilestone[] {
  const normalized = normalizeMilestoneName(name)
  if (!normalized) return []

  const matched = new Set<StandardMilestone>()
  for (const rule of MILESTONE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      matched.add(rule.publicName)
    }
  }
  return STANDARD_MILESTONES.filter((stage) => matched.has(stage))
}

export function mapProjectMilestones(milestones: Array<{ name: string }>): StandardMilestone[] {
  const found = new Set<StandardMilestone>()
  for (const milestone of milestones) {
    for (const mapped of mapMilestoneName(milestone.name)) {
      found.add(mapped)
    }
  }
  return STANDARD_MILESTONES.filter((stage) => found.has(stage))
}
