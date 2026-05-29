/** Query `section` values for /projects/[id]?tab=milestones */
export const MILESTONE_SECTION_STAGES = "stages"
export const MILESTONE_SECTION_LOSS = "loss"

export const MILESTONE_SECTION_IDS = {
  stages: "milestone-project-stages",
  loss: "milestone-loss-summary",
} as const

export type MilestoneSection = typeof MILESTONE_SECTION_STAGES | typeof MILESTONE_SECTION_LOSS

export function buildMilestoneTabHref(
  projectId: string,
  section: MilestoneSection = MILESTONE_SECTION_STAGES,
): string {
  return `/projects/${projectId}?tab=milestones&section=${section}`
}

export function milestoneSectionFromHasLoss(hasStageLoss: boolean): MilestoneSection {
  return hasStageLoss ? MILESTONE_SECTION_LOSS : MILESTONE_SECTION_STAGES
}

export function tooltipForMilestoneSection(section: MilestoneSection): string {
  return section === MILESTONE_SECTION_LOSS
    ? "Stages at loss — see where spend exceeded budget"
    : "Find where money goes — open project stages"
}
