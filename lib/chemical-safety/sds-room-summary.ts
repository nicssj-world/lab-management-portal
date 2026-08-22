import type { ChemicalSdsDTO } from './types'

type SdsHoldingLink = Pick<ChemicalSdsDTO, 'sourceHoldingId' | 'linkedHoldingIds' | 'status'>

export interface RoomSdsSummary {
  holdingCount: number
  linkedHoldingCount: number
  missingHoldingCount: number
  versionCount: number
}

/** Return only the SDS versions that belong to one registry holding. */
export function sdsItemsForHolding<T extends SdsHoldingLink>(items: T[], holdingId: string): T[] {
  return items.filter(item => (
    item.sourceHoldingId === holdingId || item.linkedHoldingIds.includes(holdingId)
  ))
}

/** Return only the current/non-superseded SDS versions for one registry holding. */
export function currentSdsItemsForHolding<T extends SdsHoldingLink>(items: T[], holdingId: string): T[] {
  return sdsItemsForHolding(items, holdingId).filter(item => item.status !== 'superseded')
}

/** Keep registry-item counts separate from SDS-version counts. */
export function summarizeRoomSds(
  holdings: Array<{ holdingId: string }>,
  items: SdsHoldingLink[],
): RoomSdsSummary {
  const linkedHoldingCount = holdings.filter(holding => (
    currentSdsItemsForHolding(items, holding.holdingId).length > 0
  )).length

  return {
    holdingCount: holdings.length,
    linkedHoldingCount,
    missingHoldingCount: holdings.length - linkedHoldingCount,
    versionCount: items.filter(item => item.status !== 'superseded').length,
  }
}
