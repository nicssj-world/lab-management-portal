import assert from 'node:assert/strict'
import {
  classifySubmissionStatus,
  getSubmissionDeadline,
  compareFiscalPeriods,
  type FiscalPeriod,
} from './compliance'

assert.equal(getSubmissionDeadline(2569, 7), '2026-08-15', 'July 2569 is due on 15 August 2026')
assert.equal(getSubmissionDeadline(2569, 9), '2026-10-15', 'September rolls into the next fiscal year')
assert.equal(getSubmissionDeadline(2569, 12), '2026-01-15', 'December rolls into January')
assert.equal(getSubmissionDeadline(2568, 10), '2024-11-15', 'October uses the correct Gregorian year')

const current: FiscalPeriod = { fiscalYear: 2569, month: 8 }
const trackingStart: FiscalPeriod = current
const baseline: FiscalPeriod = { fiscalYear: 2569, month: 7 }

assert.equal(compareFiscalPeriods(baseline, current), -1)
assert.equal(compareFiscalPeriods(current, current), 0)
assert.equal(compareFiscalPeriods({ fiscalYear: 2570, month: 1 }, current), 1)

assert.equal(
  classifySubmissionStatus({
    period: baseline,
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 3,
    filledCount: 3,
    baseline: true,
    now: new Date('2026-08-24T00:00:00.000Z'),
  }),
  'on_time',
  'a complete baseline period is treated as on time',
)
assert.equal(
  classifySubmissionStatus({
    period: baseline,
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 3,
    filledCount: 2,
    baseline: true,
    now: new Date('2026-08-24T00:00:00.000Z'),
  }),
  'missed',
  'an incomplete baseline period is missed',
)
assert.equal(
  classifySubmissionStatus({
    period: { fiscalYear: 2569, month: 6 },
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 3,
    filledCount: 3,
    now: new Date('2026-08-24T00:00:00.000Z'),
  }),
  'not_tracked',
)
assert.equal(
  classifySubmissionStatus({
    period: current,
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 3,
    filledCount: 0,
    now: new Date('2026-08-24T00:00:00.000Z'),
  }),
  'not_open',
)
assert.equal(
  classifySubmissionStatus({
    period: baseline,
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 3,
    filledCount: 1,
    now: new Date('2026-08-10T00:00:00.000Z'),
  }),
  'pending',
  'an incomplete previous month remains pending before the 15th',
)
assert.equal(
  classifySubmissionStatus({
    period: baseline,
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 3,
    filledCount: 3,
    firstCompletedAt: '2026-08-15T16:59:59.999Z',
    now: new Date('2026-08-15T16:59:59.999Z'),
  }),
  'on_time',
  'the Bangkok deadline includes 23:59:59.999 on the 15th',
)
assert.equal(
  classifySubmissionStatus({
    period: baseline,
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 3,
    filledCount: 3,
    firstCompletedAt: '2026-08-15T17:00:00.000Z',
    now: new Date('2026-08-24T00:00:00.000Z'),
  }),
  'missed',
  'a complete submission first finished after the deadline stays missed',
)
assert.equal(
  classifySubmissionStatus({
    period: baseline,
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 3,
    filledCount: 1,
    now: new Date('2026-08-16T00:00:00.000Z'),
  }),
  'missed',
)
assert.equal(
  classifySubmissionStatus({
    period: baseline,
    currentPeriod: current,
    trackingStart: baseline,
    requiredCount: 0,
    filledCount: 0,
    now: new Date('2026-08-24T00:00:00.000Z'),
  }),
  'not_applicable',
)

console.log('KPI compliance tests passed')
