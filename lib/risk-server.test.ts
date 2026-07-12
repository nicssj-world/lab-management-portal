import assert from 'node:assert/strict'
import { normalizeRiskPayload } from './risk-server'

// Date fields get normalized (BE→CE, day/month swap, etc.) same as the import pipeline
const full = normalizeRiskPayload({
  event_date: '31/07/2569',
  recorded_date: '2569-07-11',
  due_date: '31/7/68',
  follow_up_date: null,
  event_detail: 'test',
})
assert.equal(full.event_date, '2026-07-31')
assert.equal(full.recorded_date, '2026-07-11')
assert.equal(full.due_date, '2025-07-31')
assert.equal(full.follow_up_date, null)

// Partial update (PATCH): only normalizes keys actually present in the input, so omitted
// date fields aren't touched/added — required for the PATCH route's partial-update semantics
const partial = normalizeRiskPayload({ status: 'closed' })
assert.ok(!('event_date' in partial), 'event_date should not appear when not in the input')
assert.ok(!('due_date' in partial), 'due_date should not appear when not in the input')

// Already-ISO CE dates pass through unchanged (idempotency matters here too — PATCH may
// resubmit a value the UI already normalized)
const isoInput = normalizeRiskPayload({ event_date: '2026-07-31' })
assert.equal(isoInput.event_date, '2026-07-31')

console.log('risk-server date normalization tests passed')
