import { SAFE_QUALITY_AREAS, type SafeQualityArea } from './types.ts'

const WORK_TYPE_MAP: Record<string, SafeQualityArea> = {
  foundation: 'Foundation',
  column: 'Reinforcement',
  beam: 'Reinforcement',
  rcc: 'Concrete',
  slab: 'Concrete',
  brickwork: 'Masonry',
  masonry: 'Masonry',
  waterproofing: 'Waterproofing',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  flooring: 'Flooring',
  tiling: 'Flooring',
  plastering: 'Finishing',
  painting: 'Finishing',
}

export function mapInspectionWorkType(workType: string): SafeQualityArea | undefined {
  return WORK_TYPE_MAP[workType.trim().toLowerCase()]
}

export function mapInspectionWorkTypes(workTypes: string[] | undefined): SafeQualityArea[] {
  if (!workTypes?.length) return []
  const found = new Set<SafeQualityArea>()
  for (const workType of workTypes) {
    const mapped = mapInspectionWorkType(workType)
    if (mapped) found.add(mapped)
  }
  return SAFE_QUALITY_AREAS.filter((area) => found.has(area))
}
