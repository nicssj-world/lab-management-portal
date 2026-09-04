export const QUALITY_MEETING_LOCATIONS = [
  'ห้องประชุมกลุ่มงานเทคนิคการแพทย์',
  'งานเคมีคลินิก',
  'งานโลหิตวิทยาคลินิก',
  'งานคลังเลือด',
  'งานอณูชีววิทยา',
  'งานภูมิคุ้มกันวิทยาคลินิก',
  'งานจุลชีววิทยาคลินิก',
  'งานจุลทรรศนศาสตร์คลินิก',
  'งานศสม.',
  'งานตรวจพิเศษและตรวจต่อ',
] as const

export const OTHER_MEETING_LOCATION_VALUE = '__other__'

export type QualityMeetingLocation = typeof QUALITY_MEETING_LOCATIONS[number]

const LEGACY_QUALITY_MEETING_LOCATION_ALIASES: Readonly<Record<string, QualityMeetingLocation>> = {
  'หน้างานเคมีคลินิก': 'งานเคมีคลินิก',
  'หน้างานโลหิตวิทยาคลินิก': 'งานโลหิตวิทยาคลินิก',
  'หน้างานคลังเลือด': 'งานคลังเลือด',
  'หน้างานอณูชีววิทยา': 'งานอณูชีววิทยา',
  'หน้างานภูมิคุ้มกันวิทยาคลินิก': 'งานภูมิคุ้มกันวิทยาคลินิก',
  'หน้างานจุลชีววิทยาคลินิก': 'งานจุลชีววิทยาคลินิก',
  'หน้างานจุลทรรศนศาสตร์คลินิก': 'งานจุลทรรศนศาสตร์คลินิก',
  'หน้างานศสม.': 'งานศสม.',
  'หน้างานตรวจพิเศษและตรวจต่อ': 'งานตรวจพิเศษและตรวจต่อ',
}

export function normalizeMeetingLocation(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  return LEGACY_QUALITY_MEETING_LOCATION_ALIASES[normalized] ?? normalized
}

export function meetingLocationLabel(value: string | null | undefined) {
  return normalizeMeetingLocation(value) ?? ''
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
