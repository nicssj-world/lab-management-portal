export const HEAD_CONTACT_CATEGORIES = ['suggestion', 'complaint', 'compliment'] as const
export type HeadContactCategory = typeof HEAD_CONTACT_CATEGORIES[number]

export const HEAD_CONTACT_CATEGORY_LABEL: Record<HeadContactCategory, string> = {
  suggestion: 'ข้อเสนอแนะ',
  complaint: 'ข้อร้องเรียน',
  compliment: 'คำชื่นชม',
}

export const HEAD_CONTACT_STATUSES = ['new', 'in_progress', 'closed'] as const
export type HeadContactStatus = typeof HEAD_CONTACT_STATUSES[number]

export const HEAD_CONTACT_STATUS_LABEL: Record<HeadContactStatus, string> = {
  new: 'ใหม่',
  in_progress: 'กำลังดำเนินการ',
  closed: 'ปิดเรื่อง',
}

export const OTHER_SERVICE_UNIT = 'other' as const
export const HEAD_CONTACT_DETAIL_MIN = 10
export const HEAD_CONTACT_DETAIL_MAX = 5_000
export const HEAD_CONTACT_NAME_MAX = 200
export const HEAD_CONTACT_CONTACT_MAX = 300

export function headContactReference(id: string) {
  return `HC-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
}
