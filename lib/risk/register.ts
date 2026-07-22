// ทะเบียนความเสี่ยง (ISO 15189 8.5) — ประเมินเชิงรุกด้วย L×S ไม่ใช้ระดับ A–I แบบอุบัติการณ์

/** จำนวนวันก่อนถึงกำหนดที่เริ่มขึ้นป้ายเตือน — ใช้หน้าต่างเดียวกับการทบทวนเอกสารคุณภาพ */
export const REVIEW_WINDOW_DAYS = 90

/** รอบทบทวนความเสี่ยง 1 ปีตามข้อกำหนด */
export const REVIEW_CYCLE_MONTHS = 12

export function todayBangkok() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

/** เลื่อนกำหนดทบทวนไปอีก 1 ปีนับจากวันที่ทบทวน */
export function nextReviewDate(from: string = todayBangkok()) {
  const [year, month, day] = from.split('-').map(Number)
  const date = new Date(year, month - 1 + REVIEW_CYCLE_MONTHS, day)
  return date.toLocaleDateString('en-CA')
}

/** วันที่เริ่มขึ้นป้าย "ต้องทบทวน" — ใช้เป็นขอบบนในการ query */
export function reviewDueThreshold() {
  const today = new Date()
  today.setDate(today.getDate() + REVIEW_WINDOW_DAYS)
  return today.toLocaleDateString('en-CA')
}

export type ReviewState = 'ok' | 'due' | 'overdue' | 'unset'

export function reviewState(nextReview?: string | null): ReviewState {
  if (!nextReview) return 'unset'
  const today = todayBangkok()
  if (nextReview < today) return 'overdue'
  return nextReview <= reviewDueThreshold() ? 'due' : 'ok'
}
