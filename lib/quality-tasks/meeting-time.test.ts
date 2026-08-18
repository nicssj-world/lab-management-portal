import assert from 'node:assert/strict'
import {
  formatMeetingTimeRange,
  getMeetingTimePreset,
  MEETING_TIME_PRESETS,
  normalizeMeetingTime,
  shouldShowAdHocTimePicker,
} from './meeting-time'

assert.deepEqual(MEETING_TIME_PRESETS, {
  morning: { startTime: '08:30', endTime: '12:00' },
  lunch: { startTime: '12:00', endTime: '13:00' },
  afternoon: { startTime: '13:00', endTime: '16:00' },
})
assert.deepEqual(normalizeMeetingTime(null, null), { startTime: null, endTime: null })
assert.deepEqual(normalizeMeetingTime('08:30:00', '12:00:00'), { startTime: '08:30', endTime: '12:00' })
assert.deepEqual(normalizeMeetingTime('12:00', '13:00'), { startTime: '12:00', endTime: '13:00' })
assert.deepEqual(normalizeMeetingTime('13:00', '16:00'), { startTime: '13:00', endTime: '16:00' })

assert.throws(() => normalizeMeetingTime('08:30', null), /ต้องระบุเวลาเริ่มและเวลาสิ้นสุด/)
assert.throws(() => normalizeMeetingTime('12:00', '12:00'), /ต้องมากกว่าเวลาเริ่ม/)
assert.throws(() => normalizeMeetingTime('16:30', '13:00'), /ต้องมากกว่าเวลาเริ่ม/)
assert.throws(() => normalizeMeetingTime('ข้าวเที่ยง', '13:00'), /รูปแบบเวลาไม่ถูกต้อง/)

assert.equal(getMeetingTimePreset(null, null), 'all_day')
assert.equal(getMeetingTimePreset('08:30', '12:00'), 'morning')
assert.equal(getMeetingTimePreset('12:00:00', '13:00:00'), 'lunch')
assert.equal(getMeetingTimePreset('13:00:00', '16:00:00'), 'afternoon')
assert.equal(getMeetingTimePreset('10:00', '11:30'), 'custom')
assert.equal(shouldShowAdHocTimePicker(null), true)
assert.equal(shouldShowAdHocTimePicker('meeting'), true)
assert.equal(shouldShowAdHocTimePicker('activity'), false)
assert.equal(formatMeetingTimeRange(null, null), null)
assert.equal(formatMeetingTimeRange('08:30:00', '12:00:00'), '08:30–12:00 น.')

console.log('lib/quality-tasks/meeting-time.test.ts: all assertions passed')
