export const REJECTION_ANALYSIS_VERSION = '2026-08-25-v1'

export const REJECTION_REASON_CATEGORIES = [
  { code: 'no_detail', label: 'ไม่ระบุรายละเอียด' },
  { code: 'repeat_duplicate', label: 'ส่งตรวจซ้ำ / ซ้ำซ้อน' },
  { code: 'cancelled', label: 'ยกเลิกการตรวจ' },
  { code: 'request_order', label: 'Request / รายการตรวจไม่ถูกต้อง' },
  { code: 'specimen_missing', label: 'ไม่มี / ไม่ได้ส่งสิ่งส่งตรวจ' },
  { code: 'specimen_type', label: 'ชนิดสิ่งส่งตรวจไม่ถูกต้อง' },
  { code: 'specimen_quality', label: 'คุณภาพหรือปริมาณสิ่งส่งตรวจไม่เหมาะสม' },
  { code: 'contamination', label: 'สิ่งส่งตรวจปนเปื้อน' },
  { code: 'label_patient', label: 'ฉลาก / ข้อมูลผู้ป่วยไม่ถูกต้อง' },
  { code: 'result_quality', label: 'ผลตรวจผิดปกติ / ต้องตรวจซ้ำ' },
  { code: 'system_data', label: 'ระบบ / การคีย์ข้อมูล' },
  { code: 'finance_eligibility', label: 'การเงิน / สิทธิ์' },
  { code: 'criteria_external', label: 'ไม่ผ่านเกณฑ์ / ส่งตรวจภายนอก' },
  { code: 'blood_bank', label: 'ธนาคารเลือด / มีกรุ๊ปแล้ว' },
  { code: 'other_review', label: 'อื่นๆ / รอตรวจสอบ' },
] as const

export type RejectionReasonCategoryCode = typeof REJECTION_REASON_CATEGORIES[number]['code']
export type RejectionAnalysisSource = 'rule' | 'review' | 'mapping' | 'unclassified'

export type RejectionClassification = {
  normalizedReason: string
  categoryCode: RejectionReasonCategoryCode
  categoryLabel: string
  confidence: number
  source: RejectionAnalysisSource
  matchedRule: string
  needsReview: boolean
}

const CATEGORY_LABELS = Object.fromEntries(
  REJECTION_REASON_CATEGORIES.map(category => [category.code, category.label])
) as Record<RejectionReasonCategoryCode, string>

type Rule = {
  id: string
  categoryCode: RejectionReasonCategoryCode
  confidence: number
  terms: string[]
}

// Rules are deliberately conservative. A free-text reason that does not match
// a known pattern stays in the review queue instead of being silently guessed.
const RULES: Rule[] = [
  {
    id: 'blood-bank-group-already-known',
    categoryCode: 'blood_bank',
    confidence: 0.98,
    terms: ['groupแล้ว', 'มีgroup', 'group เลือดแล้ว', 'กรุ๊ปเลือดแล้ว', 'หมู่เลือดแล้ว'],
  },
  {
    id: 'finance-or-eligibility',
    categoryCode: 'finance_eligibility',
    confidence: 0.96,
    terms: ['การเงิน', 'จ่ายเงิน', 'รอจ่าย', 'สิทธิ', 'ไม่ผ่านการเงิน', 'ค่าใช้จ่าย', 'เคลียค่า'],
  },
  {
    id: 'cancelled-by-requester',
    categoryCode: 'cancelled',
    confidence: 0.96,
    terms: ['ยกเลิก', 'cancel'],
  },
  {
    id: 'repeat-or-duplicate',
    categoryCode: 'repeat_duplicate',
    confidence: 0.94,
    terms: ['repeat', 'repeated', 'ซ้ำ', 'ซ้ำซ้อน', 'รีเควชซ้ำ', 'รีเควสซ้ำ', 'เคยตรวจแล้ว'],
  },
  {
    id: 'missing-specimen',
    categoryCode: 'specimen_missing',
    confidence: 0.96,
    terms: ['ไม่มี specimen', 'ไม่พบ specimen', 'ไม่มีสิ่งส่งตรวจ', 'ไม่ได้ส่ง', 'ไม่ได้เก็บ', 'คนไม่ได้เก็บ'],
  },
  {
    id: 'wrong-patient-or-label',
    categoryCode: 'label_patient',
    confidence: 0.95,
    terms: ['เจาะผิดราย', 'เลือดผิดราย', 'ผิดคน', 'เปลี่ยน hn', 'hn ผิด', 'ติดสติ๊กเกอร์', 'ไม่ติดชื่อผู้ป่วย', 'sticker', 'sticer', 'label'],
  },
  {
    id: 'contaminated-specimen',
    categoryCode: 'contamination',
    confidence: 0.97,
    terms: ['contam', 'ปนเปื้อน', 'contaminated', 'contamination'],
  },
  {
    id: 'wrong-specimen-type',
    categoryCode: 'specimen_type',
    confidence: 0.96,
    terms: ['ผิดชนิด', 'specimen ผิดชนิด', 'ส่งผิดชนิด'],
  },
  {
    id: 'specimen-quality-or-volume',
    categoryCode: 'specimen_quality',
    confidence: 0.92,
    terms: [
      'ปริมาตร', 'ไม่ถึงขีด', 'เกินขีด', 'ข้นเกินไป', 'เข้นข้น', 'หนืด', 'รั่ว', 'ฟองอากาศ', 'เก็บน้ำมา',
      'แข็งตัว', 'clot', 'hemolysis', 'หลุด', 'ปั่นหลุด', 'ดินน้ำมัน',
      'ไม่ปิดฝา', 'เจาะข้าง', 'invalid', 'invlid', 'invaid', 'invaild', 'nvalid',
    ],
  },
  {
    id: 'abnormal-result-or-repeat-result',
    categoryCode: 'result_quality',
    confidence: 0.86,
    terms: [
      'no result', 'อ่านค่าไม่ได้', 'ผลต่าง', 'เพาะเลี้ยงเซลล์ไม่ขึ้น',
      'ค่า k', 'k=', 'k <', 'k >', 'na ', 'na=', 'na<', 'na>', 'pco2', 'hct', 'plt', 'platelet',
    ],
  },
  {
    id: 'request-or-order-data',
    categoryCode: 'request_order',
    confidence: 0.9,
    terms: [
      'request', 'req ', 'rq ', 'รีเควช', 'รีเควส', 'requestผิด', 'request ผิด',
      'key lab', 'keylab', 'คีย์แลบ', 'คีย์ lab', 'คีย์ผิดรายการ', 'รหัสตรวจ', 'รหัสผิด',
      'เปลี่ยนรายการตรวจ', 'เปลี่ยน test', 'ข้อมูลไม่ครบ',
    ],
  },
  {
    id: 'system-or-lab-record',
    categoryCode: 'system_data',
    confidence: 0.9,
    terms: ['ระบบ', 'error', 'errer', 'ephis', 'his ', 'lis', 'linkเข้า', 'ลงผลไม่ได้', 'คีย์ผิด', 'key ผิด', 'เอกสารไม่ครบ'],
  },
  {
    id: 'criteria-or-external-lab',
    categoryCode: 'criteria_external',
    confidence: 0.89,
    terms: [
      'ไม่ผ่านเกณฑ์', 'นอกเกณฑ์', 'เกินเวลา', 'เกินจำนวน', 'ส่งเกิน', 'สอบสวนโรค', 'รามา', 'ภายนอก',
      'ไม่สามารถตรวจวิเคราะห์', 'ไม่ผ่าน',
    ],
  },
]

function compact(value: string): string {
  return value.replace(/\s+/g, '')
}

function hasTerm(normalized: string, term: string): boolean {
  const normalizedTerm = normalizeRejectionReason(term)
  return normalized.includes(normalizedTerm) || compact(normalized).includes(compact(normalizedTerm))
}

export function normalizeRejectionReason(reason: string | null | undefined): string {
  if (!reason) return ''
  return reason
    .normalize('NFKC')
    .replace(/[\u200B\uFEFF]/g, '')
    .toLocaleLowerCase('th-TH')
    .replace(/[“”"'`.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function categoryLabel(code: RejectionReasonCategoryCode): string {
  return CATEGORY_LABELS[code]
}

export function isRejectionReasonCategoryCode(value: unknown): value is RejectionReasonCategoryCode {
  return typeof value === 'string' && REJECTION_REASON_CATEGORIES.some(category => category.code === value)
}

export function classifyRejectionReason(reason: string | null | undefined): RejectionClassification {
  const normalizedReason = normalizeRejectionReason(reason)

  if (!normalizedReason) {
    return {
      normalizedReason,
      categoryCode: 'no_detail',
      categoryLabel: categoryLabel('no_detail'),
      confidence: 1,
      source: 'rule',
      matchedRule: 'empty-reason',
      needsReview: false,
    }
  }

  for (const rule of RULES) {
    if (rule.terms.some(term => hasTerm(normalizedReason, term))) {
      return {
        normalizedReason,
        categoryCode: rule.categoryCode,
        categoryLabel: categoryLabel(rule.categoryCode),
        confidence: rule.confidence,
        source: 'rule',
        matchedRule: rule.id,
        needsReview: false,
      }
    }
  }

  return {
    normalizedReason,
    categoryCode: 'other_review',
    categoryLabel: categoryLabel('other_review'),
    confidence: 0.2,
    source: 'unclassified',
    matchedRule: 'no-rule-match',
    needsReview: true,
  }
}

export function applyReviewedCategory(
  classification: RejectionClassification,
  categoryCode: RejectionReasonCategoryCode,
  source: 'review' | 'mapping' = 'review'
): RejectionClassification {
  return {
    ...classification,
    categoryCode,
    categoryLabel: categoryLabel(categoryCode),
    confidence: 1,
    source,
    matchedRule: 'reviewed-mapping',
    needsReview: false,
  }
}
