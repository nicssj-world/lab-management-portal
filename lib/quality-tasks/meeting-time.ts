export type MeetingTimePreset = 'all_day' | 'morning' | 'lunch' | 'afternoon' | 'custom'

export const MEETING_TIME_PRESETS = {
  morning: { startTime: '08:30', endTime: '12:00' },
  lunch: { startTime: '12:00', endTime: '13:00' },
  afternoon: { startTime: '13:00', endTime: '16:00' },
} as const

export function shouldShowAdHocTimePicker(taskKind: 'activity' | 'meeting' | null | undefined) {
  return taskKind == null || taskKind === 'meeting'
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/

function normalizeTime(value: string) {
  return value.length === 8 ? value.slice(0, 5) : value
}

export function normalizeMeetingTime(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
) {
  const start = startTime?.trim() || null
  const end = endTime?.trim() || null
  if (!start && !end) return { startTime: null, endTime: null }
  if (!start || !end) throw new Error('ต้องระบุเวลาเริ่มและเวลาสิ้นสุดให้ครบ')
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    throw new Error('รูปแบบเวลาไม่ถูกต้อง')
  }
  const normalizedStart = normalizeTime(start)
  const normalizedEnd = normalizeTime(end)
  if (normalizedEnd <= normalizedStart) throw new Error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม')
  return { startTime: normalizedStart, endTime: normalizedEnd }
}

export function getMeetingTimePreset(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): MeetingTimePreset {
  const normalized = normalizeMeetingTime(startTime, endTime)
  if (!normalized.startTime && !normalized.endTime) return 'all_day'
  if (
    normalized.startTime === MEETING_TIME_PRESETS.morning.startTime &&
    normalized.endTime === MEETING_TIME_PRESETS.morning.endTime
  ) return 'morning'
  if (
    normalized.startTime === MEETING_TIME_PRESETS.lunch.startTime &&
    normalized.endTime === MEETING_TIME_PRESETS.lunch.endTime
  ) return 'lunch'
  if (
    normalized.startTime === MEETING_TIME_PRESETS.afternoon.startTime &&
    normalized.endTime === MEETING_TIME_PRESETS.afternoon.endTime
  ) return 'afternoon'
  return 'custom'
}

export function formatMeetingTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
) {
  const normalized = normalizeMeetingTime(startTime, endTime)
  if (!normalized.startTime || !normalized.endTime) return null
  return `${normalized.startTime}–${normalized.endTime} น.`
}
