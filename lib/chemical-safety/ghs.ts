// แปลงข้อความจำแนกความเป็นอันตรายภาษาไทยจาก Unit Chemical Inventory List ให้เป็นสัญลักษณ์ GHS
//
// ข้อความต้นทางมาจากการสกัดข้อความ PDF จึงมีร่องรอยความเสียหายของสระ/วรรณยุกต์อยู่จริง
// (เช่น "พิษต ่า" ที่ควรเป็น "พิษต่ำ") normalizeThaiHazardText จึงซ่อมก่อนจับคู่เสมอ
//
// กติกา: ห้ามเดา ถ้าเจอวลีที่ไม่รู้จักต้องคืนมาใน unmatched ให้ผู้เรียกตัดสินใจ
// ผู้เรียกที่บันทึกลงฐานข้อมูล (materializer) ต้อง throw เมื่อ unmatched ไม่ว่าง

import type { GhsPictogramCode } from './types'

export interface ThaiGhsClass {
  /** วลีภาษาไทยที่ปรากฏใน master list (รูปที่ซ่อมแล้ว) */
  phraseTh: string
  /** null = จำแนกไว้แต่ไม่มีสัญลักษณ์ GHS กำกับ เช่น "ของแข็งไม่กำหนดประเภท" */
  pictogram: GhsPictogramCode | null
  classTh: string
  classEn: string
}

export interface ThaiGhsHazardClass {
  classTh: string
  classEn: string
}

export interface ThaiGhsParseResult {
  pictogramCodes: GhsPictogramCode[]
  hazardClasses: ThaiGhsHazardClass[]
  /** ส่วนของข้อความที่จับคู่ไม่ได้ หลังตัดวลีที่รู้จักและคำเชื่อมออกแล้ว */
  unmatched: string[]
}

// เรียงจากวลียาวไปสั้น เพื่อให้ "พิษเฉียบพลัน (มีความเป็นพิษสูง)" ถูกจับก่อน "พิษเฉียบพลัน"
export const THAI_GHS_CLASSES: readonly ThaiGhsClass[] = Object.freeze([
  {
    phraseTh: 'ความเป็นอันตรายต่อสิ่งแวดล้อมทางน้ำ',
    pictogram: 'GHS09',
    classTh: 'ความเป็นอันตรายต่อสิ่งแวดล้อมทางน้ำ',
    classEn: 'Hazardous to the aquatic environment',
  },
  {
    phraseTh: 'พิษเฉียบพลัน (มีความเป็นพิษสูง)',
    pictogram: 'GHS06',
    classTh: 'พิษเฉียบพลัน (มีความเป็นพิษสูง)',
    classEn: 'Acute toxicity — high',
  },
  {
    phraseTh: 'พิษเฉียบพลัน (มีความเป็นพิษต่ำ)',
    pictogram: 'GHS07',
    classTh: 'พิษเฉียบพลัน (มีความเป็นพิษต่ำ)',
    classEn: 'Acute toxicity — low',
  },
  {
    phraseTh: 'ของแข็งไม่กำหนดประเภท',
    pictogram: null,
    classTh: 'ของแข็งไม่กำหนดประเภท',
    classEn: 'Solid, not otherwise classified',
  },
  {
    phraseTh: 'สารที่กัดกร่อนโลหะ',
    pictogram: 'GHS05',
    classTh: 'สารที่กัดกร่อนโลหะ',
    classEn: 'Corrosive to metals',
  },
  {
    phraseTh: 'อันตรายต่อสุขภาพ',
    pictogram: 'GHS08',
    classTh: 'อันตรายต่อสุขภาพ',
    classEn: 'Serious health hazard',
  },
  {
    phraseTh: 'ก๊าซไวไฟ',
    pictogram: 'GHS02',
    classTh: 'ก๊าซไวไฟ',
    classEn: 'Flammable',
  },
])

// ความเสียหายจากการสกัดข้อความ PDF ที่พบจริงในไฟล์ Update June 2026
// คีย์คือรูปที่เสีย ค่าคือรูปที่ถูก — ใช้แทนที่ตรง ๆ ไม่ใช่การเดาเชิงภาษา
const OCR_REPAIRS: ReadonlyArray<readonly [RegExp, string]> = [
  [/พิษต\s*่?\s*า/g, 'พิษต่ำ'],
  [/สารที\s*กัดกร่อน/g, 'สารที่กัดกร่อน'],
  [/สิ\s*งแวดล้อม/g, 'สิ่งแวดล้อม'],
  [/ทางน\s*่?\s*า/g, 'ทางน้ำ'],
  [/ไม่ก\s*่?\s*าหนด/g, 'ไม่กำหนด'],
  // การขึ้นบรรทัดใหม่ใน PDF ตัดคำว่า "ความเป็นอันตราย" ออกเป็นสองท่อน
  [/ความ\s+เป็นอันตราย/g, 'ความเป็นอันตราย'],
]

// คำ/อักขระที่ใช้คั่นวลีเท่านั้น ไม่มีความหมายเชิงการจำแนก
const CONNECTOR_PATTERN = /(?:และ|กับ|หรือ|,|·|\s)+/g

export function normalizeThaiHazardText(raw: string | null | undefined): string {
  let text = (raw ?? '').normalize('NFC')
  for (const [pattern, replacement] of OCR_REPAIRS) text = text.replace(pattern, replacement)
  return text.replace(/\s+/g, ' ').trim()
}

export function parseThaiGhsText(raw: string | null | undefined): ThaiGhsParseResult {
  const normalized = normalizeThaiHazardText(raw)
  if (normalized === '') return { pictogramCodes: [], hazardClasses: [], unmatched: [] }

  // ตัดวลีที่รู้จักออกทีละวลี แล้วดูว่าเหลืออะไร — วิธีนี้ทนต่อการคั่นที่ไม่สม่ำเสมอ
  // ("ก๊าซไวไฟ และ พิษ...", "ก๊าซไวไฟ พิษ...", "...(มีความเป็นพิษต่ำ) และความ เป็นอันตราย...")
  let remainder = normalized
  const matched: ThaiGhsClass[] = []

  for (const candidate of THAI_GHS_CLASSES) {
    if (!remainder.includes(candidate.phraseTh)) continue
    matched.push(candidate)
    remainder = remainder.split(candidate.phraseTh).join(' ')
  }

  const unmatched = remainder
    .replace(CONNECTOR_PATTERN, ' ')
    .split(' ')
    .map(part => part.trim())
    .filter(part => part !== '')

  const pictogramCodes = [
    ...new Set(matched.map(item => item.pictogram).filter((code): code is GhsPictogramCode => code !== null)),
  ].sort()

  const hazardClasses = matched
    .map(item => ({ classTh: item.classTh, classEn: item.classEn }))
    .sort((left, right) => left.classEn.localeCompare(right.classEn, 'en'))

  return { pictogramCodes, hazardClasses, unmatched }
}

/** ใช้ตอนบันทึกลงฐานข้อมูล — ไม่ยอมให้ข้อความที่แปลไม่ออกผ่านไปแบบเงียบ */
export function parseThaiGhsTextOrThrow(raw: string | null | undefined, context: string): ThaiGhsParseResult {
  const result = parseThaiGhsText(raw)
  if (result.unmatched.length > 0) {
    throw new Error(`Unrecognized Thai GHS phrase for ${context}: ${result.unmatched.join(' | ')}`)
  }
  return result
}
