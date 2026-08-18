export const SAFETY_INSPECTION_INTERVAL_DAYS = 30
export const SAFETY_INSPECTION_SCHEDULE_LABEL = `ตรวจครั้งถัดไป (ระบบกำหนดทุก ${SAFETY_INSPECTION_INTERVAL_DAYS} วัน)`

export function nextSafetyInspectionDate(inspectedOn: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inspectedOn)
  if (!match) throw new Error('วันที่ตรวจต้องอยู่ในรูปแบบ YYYY-MM-DD')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('วันที่ตรวจไม่ถูกต้อง')
  }

  date.setUTCDate(date.getUTCDate() + SAFETY_INSPECTION_INTERVAL_DAYS)
  return date.toISOString().slice(0, 10)
}
