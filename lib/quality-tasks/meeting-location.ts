export const QUALITY_MEETING_LOCATIONS = [
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
] as const

export const OTHER_MEETING_LOCATION_VALUE = '__other__'

export type QualityMeetingLocation = typeof QUALITY_MEETING_LOCATIONS[number]

export function normalizeMeetingLocation(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

export function isStandardMeetingLocation(value: string | null | undefined): value is QualityMeetingLocation {
  const normalized = normalizeMeetingLocation(value)
  return normalized !== null && (QUALITY_MEETING_LOCATIONS as readonly string[]).includes(normalized)
}

export function meetingLocationOptionValue(value: string | null | undefined) {
  const normalized = normalizeMeetingLocation(value)
  if (!normalized) return ''
  return isStandardMeetingLocation(normalized) ? normalized : OTHER_MEETING_LOCATION_VALUE
}

/**
 * An empty/unknown location is treated as occupying the shared booking pool.
 * Two non-empty, different location names can therefore overlap safely.
 */
export function meetingLocationsConflict(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeMeetingLocation(a)
  const right = normalizeMeetingLocation(b)
  if (!left || !right) return true
  return left.toLocaleLowerCase('en-US') === right.toLocaleLowerCase('en-US')
}
