import assert from 'node:assert/strict'
import {
  daysOverdue, isRiskUrgent, filterUrgentRisks, sortByOldestUpdated,
  monthsLeftUntil, sortContractsByUrgency, type RiskRow,
} from './attention-queue'

const TODAY = '2026-07-11'

function risk(overrides: Partial<RiskRow> = {}): RiskRow {
  return {
    id: 1, risk_no: 'RM-001', name: 'ตัวอย่างความเสี่ยง',
    severity_level: null, status: 'open', due_date: null, follow_up_date: null,
    ...overrides,
  }
}

// daysOverdue
assert.equal(daysOverdue(null, TODAY), null)
assert.equal(daysOverdue('2026-07-11', TODAY), null) // today is not overdue
assert.equal(daysOverdue('2026-07-06', TODAY), 5)
assert.equal(daysOverdue('2026-07-20', TODAY), null) // future date is not overdue

// isRiskUrgent
assert.equal(isRiskUrgent(risk({ status: 'closed', due_date: '2026-01-01' }), TODAY), false)
assert.equal(isRiskUrgent(risk({ due_date: '2026-07-06' }), TODAY), true) // overdue
assert.equal(isRiskUrgent(risk({ severity_level: 'g' }), TODAY), true) // severe (case-insensitive)
assert.equal(isRiskUrgent(risk({ severity_level: 'C' }), TODAY), false) // not severe, not overdue
assert.equal(isRiskUrgent(risk(), TODAY), false)

// filterUrgentRisks: severity desc, then days-overdue desc
const risks = [
  risk({ id: 1, risk_no: 'A', severity_level: 'F', due_date: null }),
  risk({ id: 2, risk_no: 'B', severity_level: 'I', due_date: null }),
  risk({ id: 3, risk_no: 'C', severity_level: null, due_date: '2026-06-01' }), // overdue, no severity
  risk({ id: 4, risk_no: 'D', severity_level: 'I', due_date: '2026-07-01' }), // same top severity, more overdue
  risk({ id: 5, risk_no: 'E', severity_level: 'C', due_date: null }), // not urgent at all
]
assert.deepEqual(
  filterUrgentRisks(risks, TODAY).map(r => r.risk_no),
  ['D', 'B', 'A', 'C'],
)

// sortByOldestUpdated
const docs = [
  { id: '1', updated_at: '2026-07-01T00:00:00Z' },
  { id: '2', updated_at: '2026-06-20T00:00:00Z' },
  { id: '3', updated_at: '2026-07-05T00:00:00Z' },
]
assert.deepEqual(sortByOldestUpdated(docs).map(d => d.id), ['2', '1', '3'])

// monthsLeftUntil
assert.equal(monthsLeftUntil(null, new Date('2026-07-11')), 999)
assert.equal(monthsLeftUntil('2026-10-11', new Date('2026-07-11')), 3)

// sortContractsByUrgency: nearest end_date first, then lowest budget-remaining %
const contracts = [
  { id: 1, end_date: '2027-06-11', total: 100, used: 90 },  // far out, low budget remaining (10%)
  { id: 2, end_date: '2026-08-11', total: 100, used: 10 },  // 1 month left, high budget remaining
  { id: 3, end_date: '2026-08-11', total: 100, used: 50 },  // same months-left, more budget remaining than #2
]
assert.deepEqual(
  sortContractsByUrgency(contracts).map(c => c.id),
  [2, 3, 1],
)

console.log('lib/dashboard/attention-queue.test.ts: all assertions passed')
