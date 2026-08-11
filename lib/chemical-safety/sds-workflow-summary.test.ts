import assert from 'node:assert/strict'
import { summarizeSdsWorkflow } from './sds-workflow-summary'

assert.deepEqual(
  summarizeSdsWorkflow([
    { status: 'draft' },
    { status: 'in_review' },
    { status: 'approved' },
    { status: 'rejected' },
    { status: 'superseded' },
    { status: 'approved' },
  ]),
  {
    total: 6,
    draft: 1,
    inReview: 1,
    approved: 2,
    rejected: 1,
    superseded: 1,
  },
  'สรุปสถานะ SDS ต้องนับจากเวอร์ชันกลางทุกปลายทาง',
)

console.log('chemical-safety SDS workflow summary: ok')
