import { DEFAULT_MILESTONES } from '@/lib/projects/default-milestones'

export const CONSTRUCTION_PREVIEW_MILESTONES = DEFAULT_MILESTONES.map((m) => ({
  name: m.name,
  status: 'pending' as const,
}))

export const CONSTRUCTION_PREVIEW_SITE_PHOTOS = [
  { id: 'preview-1', label: 'Foundation work', date: 'Preview', caption: 'Site photo sample' },
  { id: 'preview-2', label: 'Structural framing', date: 'Preview', caption: 'Site photo sample' },
  { id: 'preview-3', label: 'Exterior progress', date: 'Preview', caption: 'Site photo sample' },
  { id: 'preview-4', label: 'Finishing stage', date: 'Preview', caption: 'Site photo sample' },
]

export const CONSTRUCTION_PREVIEW_PAYMENTS = [
  { stage: 'Foundation', amount: 0, status: 'upcoming' as const },
  { stage: 'Superstructure', amount: 0, status: 'upcoming' as const },
  { stage: 'Finishing', amount: 0, status: 'upcoming' as const },
]
