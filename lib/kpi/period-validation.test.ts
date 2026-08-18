import assert from 'node:assert/strict'
import { canEditKpiPeriod, getPreviousKpiPeriod, isKpiPeriodLocked, isValidKpiFiscalYear, isValidKpiMonth } from './period-validation'

assert.equal(isValidKpiFiscalYear(2569), true)
assert.equal(isValidKpiFiscalYear(2499), false)
assert.equal(isValidKpiMonth(12), true)
assert.equal(isValidKpiMonth(13), false)

const august2026 = new Date('2026-08-18T12:00:00+07:00')
assert.equal(isKpiPeriodLocked(2569, 7, august2026), false, 'last completed month must be writable')
assert.equal(isKpiPeriodLocked(2569, 8, august2026), true, 'current month must remain locked until it ends')
assert.equal(isKpiPeriodLocked(2569, 9, august2026), true, 'later month in the current fiscal year must be locked')
assert.equal(isKpiPeriodLocked(2569, 1, august2026), false, 'past month in the current fiscal year must remain writable')
assert.equal(isKpiPeriodLocked(2568, 12, august2026), false, 'past fiscal year must remain writable')
assert.equal(isKpiPeriodLocked(2570, 10, august2026), true, 'future fiscal year must be locked')
assert.equal(canEditKpiPeriod(false, 2569, 8, august2026), false, 'regular users must not edit the current month')
assert.equal(canEditKpiPeriod(true, 2570, 10, august2026), true, 'admins must be able to edit future periods')
assert.deepEqual(getPreviousKpiPeriod(august2026), { fiscalYear: 2569, month: 7 })

const october2026 = new Date('2026-10-01T12:00:00+07:00')
assert.equal(isKpiPeriodLocked(2569, 12, october2026), false, 'previous fiscal year must be writable after fiscal-year rollover')
assert.equal(isKpiPeriodLocked(2570, 10, october2026), true, 'first month of the new fiscal year must remain locked on October 1')
assert.equal(isKpiPeriodLocked(2570, 11, october2026), true, 'next month after fiscal-year rollover must be locked')
assert.deepEqual(getPreviousKpiPeriod(october2026), { fiscalYear: 2569, month: 9 })

const january2027 = new Date('2027-01-18T12:00:00+07:00')
assert.equal(isKpiPeriodLocked(2570, 10, january2027), false, 'October must be writable after the fiscal year reaches January')
assert.equal(isKpiPeriodLocked(2570, 1, january2027), true, 'January must remain locked until it ends')
assert.equal(isKpiPeriodLocked(2570, 2, january2027), true, 'February must be locked while January is current')
assert.deepEqual(getPreviousKpiPeriod(january2027), { fiscalYear: 2570, month: 12 })
console.log('KPI period validation tests passed')
