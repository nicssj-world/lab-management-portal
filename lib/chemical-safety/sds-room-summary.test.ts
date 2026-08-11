import assert from 'node:assert/strict'
import { sdsItemsForHolding, summarizeRoomSds } from './sds-room-summary'

const items = [
  { sourceHoldingId: 'holding-1', linkedHoldingIds: [], status: 'approved' as const },
  { sourceHoldingId: 'holding-1', linkedHoldingIds: [], status: 'draft' as const },
  { sourceHoldingId: null, linkedHoldingIds: ['holding-2'], status: 'approved' as const },
]

assert.equal(sdsItemsForHolding(items, 'holding-1').length, 2)
assert.equal(sdsItemsForHolding(items, 'holding-2').length, 1)
assert.equal(sdsItemsForHolding(items, 'holding-3').length, 0)

assert.deepEqual(
  summarizeRoomSds(
    [{ holdingId: 'holding-1' }, { holdingId: 'holding-2' }, { holdingId: 'holding-3' }],
    items,
  ),
  {
    holdingCount: 3,
    linkedHoldingCount: 2,
    missingHoldingCount: 1,
    versionCount: 3,
  },
)

console.log('sds-room-summary: ok')
