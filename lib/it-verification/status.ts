export type RoundStatus = 'draft' | 'submitted' | 'reviewed'
export type SamplingRunStatus = 'completed' | 'skipped_existing' | 'no_population' | 'failed' | 'void'
export type SampleResult = 'pass' | 'fail' | 'na' | null
export type FindingStatus = 'open' | 'in_progress' | 'closed'

const ROUND_LABELS: Record<RoundStatus, string> = {
  draft: 'กำลังตรวจ',
  submitted: 'รอผู้ตรวจสอบ',
  reviewed: 'ล็อกแล้ว',
}

export function statusLabel(status: string | null | undefined): string {
  if (status && status in ROUND_LABELS) return ROUND_LABELS[status as RoundStatus]
  if (status === 'ready') return 'พร้อมส่งตรวจ'
  if (status === 'completed') return 'สุ่มแล้ว'
  if (status === 'skipped_existing') return 'ใช้ชุดเดิม'
  if (status === 'no_population') return 'ไม่มีข้อมูล TAT'
  if (status === 'failed') return 'ต้องลองใหม่'
  if (status === 'void') return 'ยกเลิกชุดเดิม'
  if (status === 'open') return 'เปิดอยู่'
  if (status === 'in_progress') return 'กำลังแก้ไข'
  if (status === 'closed') return 'ปิดแล้ว'
  return 'ยังไม่เริ่ม'
}

export function isRoundReady(input: {
  target: number
  samples: number
  incomplete: number
  openFindings: number
}): boolean {
  return input.samples >= input.target && input.incomplete === 0 && input.openFindings === 0
}

export function sampleComplete(lisToHis: SampleResult, sourceToLis: SampleResult, remark = ''): boolean {
  const results = [lisToHis, sourceToLis]
  if (results.some((result) => result === null)) return false
  if (results.includes('na') && remark.trim() === '') return false
  return true
}
