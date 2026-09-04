import assert from 'node:assert/strict'
import {
  isStandardMeetingLocation,
  meetingLocationOptionValue,
  meetingLocationsConflict,
  normalizeMeetingLocation,
  OTHER_MEETING_LOCATION_VALUE,
  QUALITY_MEETING_LOCATIONS,
} from './meeting-location'

assert.deepEqual([...QUALITY_MEETING_LOCATIONS], [
  'ห้องประชุมกลุ่มงานเทคนิคการแพทย์',
  'หน้างานเคมีคลินิก',
  'หน้างานโลหิตวิทยาคลินิก',
  'หน้างานคลังเลือด',
  'หน้างานอณูชีววิทยา',
  'หน้างานภูมิคุ้มกันวิทยาคลินิก',
  'หน้างานจุลชีววิทยาคลินิก',
  'หน้างานจุลทรรศนศาสตร์คลินิก',
  'หน้างานศสม.',
  'หน้างานตรวจพิเศษและตรวจต่อ',
], 'keeps the ten standard meeting locations in the approved order')

assert.equal(QUALITY_MEETING_LOCATIONS.length, 10)
assert.equal(normalizeMeetingLocation('  ห้องประชุม 1  '), 'ห้องประชุม 1')
assert.equal(normalizeMeetingLocation('   '), null)
assert.equal(normalizeMeetingLocation(null), null)
assert.equal(isStandardMeetingLocation(QUALITY_MEETING_LOCATIONS[0]), true)
assert.equal(isStandardMeetingLocation('ห้องประชุม 1'), false)
assert.equal(meetingLocationOptionValue(null), '')
assert.equal(meetingLocationOptionValue(QUALITY_MEETING_LOCATIONS[1]), QUALITY_MEETING_LOCATIONS[1])
assert.equal(meetingLocationOptionValue('  ห้องประชุม 1  '), OTHER_MEETING_LOCATION_VALUE)

assert.equal(meetingLocationsConflict(' ห้องประชุม 1 ', 'ห้องประชุม 1'), true)
assert.equal(meetingLocationsConflict('Room A', 'room a'), true)
assert.equal(meetingLocationsConflict(QUALITY_MEETING_LOCATIONS[0], QUALITY_MEETING_LOCATIONS[1]), false)
assert.equal(meetingLocationsConflict('Room A', 'Room B'), false)
assert.equal(meetingLocationsConflict(null, QUALITY_MEETING_LOCATIONS[0]), true)
assert.equal(meetingLocationsConflict(QUALITY_MEETING_LOCATIONS[0], ''), true)

console.log('lib/quality-tasks/meeting-location.test.ts: all assertions passed')
