import assert from 'node:assert/strict'
import { getCheckInWindow, getScheduledCheckInOpensAt } from './check-in-window'

const scheduledOpensAt = getScheduledCheckInOpensAt('2026-09-01', '08:30:00')
assert.equal(scheduledOpensAt, '2026-09-01T00:30:00.000Z', 'a timed meeting opens one hour early in Bangkok time')

const allDayOpensAt = getScheduledCheckInOpensAt('2026-09-01', null)
assert.equal(allDayOpensAt, '2026-08-31T17:00:00.000Z', 'an all-day meeting opens at midnight in Bangkok time')

assert.equal(
  getCheckInWindow('2026-09-01', '08:30', null, new Date('2026-09-01T00:29:59.000Z')).notOpenYet,
  true,
  'check-in stays closed before the one-hour window',
)
assert.equal(
  getCheckInWindow('2026-09-01', '08:30', null, new Date('2026-09-01T00:30:00.000Z')).notOpenYet,
  false,
  'check-in opens exactly at the one-hour boundary',
)
assert.equal(
  getCheckInWindow('2026-09-01', null, null, new Date('2026-08-31T16:59:59.000Z')).notOpenYet,
  true,
  'all-day check-in stays closed before the meeting date',
)
assert.equal(
  getCheckInWindow(null, null, null, new Date('2026-09-01T00:00:00.000Z')).notOpenYet,
  true,
  'an unscheduled meeting cannot be checked in',
)
const manual = getCheckInWindow(
  '2026-09-01',
  '08:30',
  '2026-08-31T23:45:00.000Z',
  new Date('2026-08-31T23:46:00.000Z'),
)
assert.equal(manual.notOpenYet, false, 'manual early opening overrides the scheduled window')
assert.equal(manual.manuallyOpened, true, 'manual early opening is distinguishable for the UI')

console.log('lib/quality-tasks/check-in-window.test.ts: all assertions passed')
