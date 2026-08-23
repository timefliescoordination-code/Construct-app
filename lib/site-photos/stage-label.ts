export function formatStageLabel(stageName: string): string {
  const trimmed = stageName.trim()
  if (!trimmed) return 'Site photos'
  if (/stage$/i.test(trimmed)) return trimmed
  return `${trimmed} stage`
}
