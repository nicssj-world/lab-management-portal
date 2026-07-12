import assert from 'node:assert/strict'
import { REVIEW_TRACKED_TYPES } from './review'

// QM-LAB-01 was tracked under 'Manual' before the QM split; it must stay tracked as 'QM'
// after the split, or it silently drops out of the annual-review workflow.
assert.ok((REVIEW_TRACKED_TYPES as readonly string[]).includes('QM'), 'QM must remain in REVIEW_TRACKED_TYPES after the Manual/QM split')
assert.ok((REVIEW_TRACKED_TYPES as readonly string[]).includes('Manual'))
assert.ok((REVIEW_TRACKED_TYPES as readonly string[]).includes('QP'))
assert.ok((REVIEW_TRACKED_TYPES as readonly string[]).includes('WI'))

console.log('review.ts REVIEW_TRACKED_TYPES tests passed')
