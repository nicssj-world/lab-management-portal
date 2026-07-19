import assert from 'node:assert/strict'
import {
  deadlineUrgency,
  fiscalYearBeForDate,
  roundClosureBlockers,
  summarizeCoverage,
  canTransitionEqaRound,
} from './domain'

assert.equal(fiscalYearBeForDate('2025-09-30'), 2568)
assert.equal(fiscalYearBeForDate('2025-10-01'), 2569)
assert.equal(fiscalYearBeForDate('2026-09-30'), 2569)
assert.equal(fiscalYearBeForDate('2026-10-01'), 2570)

const TODAY = '2026-07-19'
assert.equal(deadlineUrgency('2026-08-19', TODAY), 'normal')
assert.equal(deadlineUrgency('2026-08-18', TODAY), 'upcoming')
assert.equal(deadlineUrgency('2026-08-03', TODAY), 'upcoming')
assert.equal(deadlineUrgency('2026-08-02', TODAY), 'due-soon')
assert.equal(deadlineUrgency('2026-07-27', TODAY), 'due-soon')
assert.equal(deadlineUrgency('2026-07-26', TODAY), 'critical')
assert.equal(deadlineUrgency('2026-07-19', TODAY), 'critical')
assert.equal(deadlineUrgency('2026-07-18', TODAY), 'overdue')

assert.deepEqual(roundClosureBlockers({
  expectedResultCount: 2,
  recordedResultCount: 1,
  reportAttachmentCount: 0,
  unacceptableResultIds: ['result-1'],
  resolvedUnacceptableResultIds: [],
}), ['results-incomplete', 'report-required', 'capa-required'])

assert.deepEqual(roundClosureBlockers({
  expectedResultCount: 2,
  recordedResultCount: 2,
  reportAttachmentCount: 1,
  unacceptableResultIds: ['result-1'],
  resolvedUnacceptableResultIds: ['result-1'],
}), [])

assert.deepEqual(summarizeCoverage([
  { mode: 'required_eqa', linkedProgram: true, completedRound: true },
  { mode: 'alternative', linkedProgram: true, completedRound: false },
  { mode: 'required_eqa', linkedProgram: false, completedRound: false },
  { mode: 'not_applicable', linkedProgram: false, completedRound: false },
]), { eligible: 3, planned: 2, completed: 1, plannedPct: 66.67, completedPct: 33.33 })

assert.equal(canTransitionEqaRound('planned', 'received'), true)
assert.equal(canTransitionEqaRound('received', 'submitted'), true)
assert.equal(canTransitionEqaRound('submitted', 'reviewed'), true)
assert.equal(canTransitionEqaRound('submitted', 'capa_open'), true)
assert.equal(canTransitionEqaRound('planned', 'reviewed'), false)
assert.equal(canTransitionEqaRound('reviewed', 'closed'), false, 'closing must use the gated close action')

console.log('lib/eqa/domain.test.ts: all assertions passed')
