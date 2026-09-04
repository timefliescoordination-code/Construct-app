import { createHash } from 'node:crypto'

export const ANONYMOUS_TITLES = [
  'A Mid-Size Family Home',
  'A Contemporary Family Residence',
  'A Multi-Level Family Home',
  'A Residential Construction Project',
  'A Modern Independent Home',
] as const

/** Stable anonymous title from the internal project id — never from client or site data. */
export function anonymousProjectTitle(projectId: string): string {
  const digest = createHash('sha256').update(projectId).digest()
  const index = digest.readUInt32BE(0) % ANONYMOUS_TITLES.length
  return ANONYMOUS_TITLES[index]
}
