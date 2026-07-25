import {
  HEAD_CONTACT_CONTACT_MAX,
  HEAD_CONTACT_DETAIL_MAX,
  HEAD_CONTACT_DETAIL_MIN,
  HEAD_CONTACT_NAME_MAX,
  OTHER_SERVICE_UNIT,
} from './constants'
import type {
  HeadContactSubmissionInput,
  HeadContactValidationIssue,
  HeadContactValidationResult,
} from './types'

export function validateHeadContactSubmission(input: HeadContactSubmissionInput): HeadContactValidationResult {
  const issues: HeadContactValidationIssue[] = []
  const senderName = input.sender_name.trim()
  const contactChannel = input.contact_channel.trim()
  const detail = input.detail.trim()
  const isOther = input.service_unit_id === OTHER_SERVICE_UNIT
  const unitName = (isOther ? input.other_service_unit : input.service_unit_name).trim()

  if (senderName.length > HEAD_CONTACT_NAME_MAX) {
    issues.push({ field: 'sender_name', message: `ชื่อยาวเกิน ${HEAD_CONTACT_NAME_MAX} ตัวอักษร` })
  }
  if (contactChannel.length > HEAD_CONTACT_CONTACT_MAX) {
    issues.push({ field: 'contact_channel', message: `ช่องทางติดต่อยาวเกิน ${HEAD_CONTACT_CONTACT_MAX} ตัวอักษร` })
  }
  if (input.wants_reply && !contactChannel) {
    issues.push({ field: 'contact_channel', message: 'กรุณาระบุช่องทางติดต่อกลับ' })
  }
  if (!input.service_unit_id) {
    issues.push({ field: 'service_unit_id', message: 'กรุณาเลือกหน่วยรับบริการ' })
  }
  if (isOther && !unitName) {
    issues.push({ field: 'other_service_unit', message: 'กรุณาระบุหน่วยรับบริการ' })
  }
  if (!isOther && !unitName) {
    issues.push({ field: 'service_unit_id', message: 'ไม่พบหน่วยรับบริการที่เลือก' })
  }
  if (unitName.length > HEAD_CONTACT_NAME_MAX) {
    issues.push({ field: isOther ? 'other_service_unit' : 'service_unit_name', message: 'ชื่อหน่วยยาวเกินกำหนด' })
  }
  if (detail.length < HEAD_CONTACT_DETAIL_MIN) {
    issues.push({ field: 'detail', message: `กรุณาระบุรายละเอียดอย่างน้อย ${HEAD_CONTACT_DETAIL_MIN} ตัวอักษร` })
  }
  if (detail.length > HEAD_CONTACT_DETAIL_MAX) {
    issues.push({ field: 'detail', message: `รายละเอียดต้องไม่เกิน ${HEAD_CONTACT_DETAIL_MAX.toLocaleString('th-TH')} ตัวอักษร` })
  }

  if (issues.length > 0) return { ok: false, issues }
  return {
    ok: true,
    row: {
      sender_name: senderName || null,
      contact_channel: contactChannel || null,
      service_unit_id: isOther ? null : input.service_unit_id,
      service_unit_snapshot: unitName,
      category: input.category,
      detail,
      wants_reply: input.wants_reply,
    },
  }
}
