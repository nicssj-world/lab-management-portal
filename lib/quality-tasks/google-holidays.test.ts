import assert from 'node:assert/strict'
import { parseGoogleThaiHolidayFeed } from './google-holidays'

const ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:official-1',
  'DTSTART;VALUE=DATE:20260413',
  'DTEND;VALUE=DATE:20260416',
  'SUMMARY:วันสงกรานต์',
  'DESCRIPTION:วันหยุดนักขัตฤกษ์',
  'STATUS:CONFIRMED',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:observance-1',
  'DTSTART;VALUE=DATE:20260214',
  'DTEND;VALUE=DATE:20260215',
  'SUMMARY:วันวาเลนไทน์',
  'DESCRIPTION:วันสำคัญ',
  'STATUS:CONFIRMED',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

assert.deepEqual(parseGoogleThaiHolidayFeed(ics, '2026-01-01', '2026-12-31'), [
  { holidayDate: '2026-04-13', name: 'วันสงกรานต์', sourceEventId: 'official-1' },
  { holidayDate: '2026-04-14', name: 'วันสงกรานต์', sourceEventId: 'official-1' },
  { holidayDate: '2026-04-15', name: 'วันสงกรานต์', sourceEventId: 'official-1' },
])

const folded = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:folded-1',
  'DTSTART;VALUE=DATE:20260101',
  'DTEND;VALUE=DATE:20260102',
  'SUMMARY:วันหยุดชดเชยวันสิ้นปี',
  ' วันหยุดราชการ',
  'DESCRIPTION:วันหยุด',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

assert.deepEqual(parseGoogleThaiHolidayFeed(folded, '2026-01-01', '2026-01-31'), [
  { holidayDate: '2026-01-01', name: 'วันหยุดชดเชยวันสิ้นปีวันหยุดราชการ', sourceEventId: 'folded-1' },
])
assert.deepEqual(parseGoogleThaiHolidayFeed(folded, '2025-01-01', '2025-12-31'), [])

console.log('lib/quality-tasks/google-holidays.test.ts: all assertions passed')
