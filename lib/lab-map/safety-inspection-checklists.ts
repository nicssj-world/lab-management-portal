import type { SafetyEquipmentKind } from './safety-domain'
import type { SafetyChecklistAnswer, SafetyChecklistTemplateItem } from './types'

const required = (key: string, labelTh: string): SafetyChecklistTemplateItem => ({ key, labelTh, required: true })

export const SAFETY_INSPECTION_CHECKLISTS: Readonly<Record<SafetyEquipmentKind, readonly SafetyChecklistTemplateItem[]>> = {
  'fire-extinguisher': [
    required('accessible', 'เข้าถึงและหยิบใช้งานได้ทันที'),
    required('seal-pin', 'ซีลและสลักนิรภัยอยู่ครบ'),
    required('pressure', 'มาตรวัดแรงดันอยู่ในช่วงพร้อมใช้'),
    required('hose-nozzle', 'สายและหัวฉีดไม่แตกร้าวหรืออุดตัน'),
    required('body-condition', 'ตัวถังไม่ผุกร่อน บุบ หรือรั่วซึม'),
    required('expiry-label', 'ฉลากและวันครบกำหนดอ่านได้ชัดเจน'),
  ],
  'fire-hose': [
    required('accessible', 'เข้าถึงตู้สายดับเพลิงได้สะดวก'),
    required('cabinet', 'ตู้และกระจกอยู่ในสภาพพร้อมใช้'),
    required('hose', 'สายไม่พับเสียรูป แตก หรือเสื่อมสภาพ'),
    required('nozzle-valve', 'หัวฉีดและวาล์วอยู่ครบและใช้งานได้'),
    required('leakage', 'ไม่พบรอยรั่วซึม'),
  ],
  'manual-call-point': [
    required('accessible', 'เข้าถึงจุดกดแจ้งเหตุได้ทันที'),
    required('cover', 'ฝาครอบหรือกระจกอยู่ในสภาพสมบูรณ์'),
    required('label', 'ป้ายระบุวิธีใช้งานชัดเจน'),
    required('indicator', 'ไฟหรือสถานะแสดงผลปกติ'),
    required('physical-condition', 'ตัวอุปกรณ์ยึดแน่นและไม่ชำรุด'),
  ],
  aed: [
    required('accessible', 'เข้าถึง AED ได้ทันทีและไม่มีสิ่งกีดขวาง'),
    required('power-self-test', 'ไฟสถานะหรือผล self-test แสดงว่าพร้อมใช้'),
    required('battery', 'แบตเตอรี่ไม่หมดอายุและมีประจุพร้อมใช้'),
    required('pads-expiry', 'แผ่นนำไฟฟ้าอยู่ครบและไม่หมดอายุ'),
    required('accessories', 'อุปกรณ์ประกอบและคู่มืออยู่ครบ'),
  ],
  'first-aid-kit': [
    required('accessible', 'เข้าถึงชุดปฐมพยาบาลได้สะดวก'),
    required('seal-container', 'กล่องหรือซีลปิดอยู่ในสภาพสมบูรณ์'),
    required('stock-completeness', 'เวชภัณฑ์มีครบตามรายการ'),
    required('expiry', 'ไม่พบเวชภัณฑ์หมดอายุ'),
    required('inventory-label', 'รายการตรวจนับและฉลากเป็นปัจจุบัน'),
  ],
  eyewash: [
    required('accessible', 'เข้าถึงอ่างล้างตาได้ทันที'),
    required('water-flow', 'น้ำไหลสม่ำเสมอทั้งสองหัว'),
    required('nozzle-caps', 'ฝาครอบหัวฉีดสะอาดและเปิดได้เอง'),
    required('cleanliness', 'อ่างและน้ำสะอาด ไม่มีสิ่งปนเปื้อน'),
    required('drain', 'ระบบระบายน้ำทำงานปกติ'),
  ],
  'emergency-shower': [
    required('accessible', 'เข้าถึงฝักบัวฉุกเฉินได้ทันที'),
    required('activation', 'คันดึงหรือกลไกเปิดทำงานได้'),
    required('flow', 'น้ำไหลเพียงพอและสม่ำเสมอ'),
    required('valve-return', 'วาล์วคงสถานะเปิดและปิดคืนได้'),
    required('signage-drain', 'ป้ายมองเห็นชัดและทางระบายน้ำพร้อมใช้'),
  ],
  'spill-kit': [
    required('accessible', 'เข้าถึงชุดจัดการสารหกรั่วไหลได้สะดวก'),
    required('seal', 'ซีลหรือภาชนะอยู่ในสภาพสมบูรณ์'),
    required('absorbent-stock', 'วัสดุดูดซับมีครบตามรายการ'),
    required('ppe-stock', 'อุปกรณ์ป้องกันส่วนบุคคลมีครบ'),
    required('waste-instructions', 'ถุงของเสียและวิธีปฏิบัติอยู่ครบ'),
  ],
  'emergency-shutoff': [
    required('accessible', 'เข้าถึงจุดตัดฉุกเฉินได้ทันที'),
    required('label', 'ป้ายระบุระบบที่ควบคุมชัดเจน'),
    required('guard-cover', 'ฝาครอบหรืออุปกรณ์ป้องกันอยู่ครบ'),
    required('physical-condition', 'สวิตช์หรือวาล์วไม่ชำรุดและยึดแน่น'),
    required('test-authorization', 'มีบันทึกการทดสอบโดยผู้ได้รับอนุญาต'),
  ],
}

export function checklistForSafetyKind(kind: SafetyEquipmentKind): readonly SafetyChecklistTemplateItem[] {
  return SAFETY_INSPECTION_CHECKLISTS[kind]
}

export function validateChecklistCompletion(
  template: readonly SafetyChecklistTemplateItem[],
  answers: readonly SafetyChecklistAnswer[],
): { valid: boolean; missingKeys: string[] } {
  const answered = new Set(answers.filter(item => item.answer).map(item => item.key))
  const missingKeys = template.filter(item => item.required && !answered.has(item.key)).map(item => item.key)
  return { valid: missingKeys.length === 0, missingKeys }
}
