import { bandCombinationKey } from './bands.ts'
import type { MarketingPortfolioItem, RecognitionRisk } from './types.ts'

export function recognitionRiskForKey(
  key: string,
  peerKeys: string[],
): RecognitionRisk {
  const matches = peerKeys.filter((peer) => peer === key).length
  return matches <= 1 ? 'HIGH' : 'LOW'
}

export function assignRecognitionRisk<T extends Pick<MarketingPortfolioItem, 'bands'>>(
  items: T[],
): Array<T & { recognitionRisk: RecognitionRisk; bandKey: string }> {
  const keys = items.map((item) => bandCombinationKey(item.bands))
  return items.map((item, index) => {
    const bandKey = keys[index] ?? ''
    return {
      ...item,
      bandKey,
      recognitionRisk: recognitionRiskForKey(bandKey, keys),
    }
  })
}
