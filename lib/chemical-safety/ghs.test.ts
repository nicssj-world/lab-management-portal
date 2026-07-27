import assert from 'node:assert/strict'
import { JUNE_2026_MASTERLIST_ROWS } from './import/masterlist-june-2026'
import { THAI_GHS_CLASSES, normalizeThaiHazardText, parseThaiGhsText, parseThaiGhsTextOrThrow } from './ghs'
import type { GhsPictogramCode } from './types'

const GHS_CODES: readonly GhsPictogramCode[] = [
  'GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09',
]

// ── ตารางการจำแนก ───────────────────────────────────────────────────────────
assert.equal(THAI_GHS_CLASSES.length, 7)
for (const entry of THAI_GHS_CLASSES) {
  assert.notEqual(entry.phraseTh.trim(), '')
  assert.notEqual(entry.classEn.trim(), '')
  if (entry.pictogram !== null) assert.ok(GHS_CODES.includes(entry.pictogram), `unknown pictogram ${entry.pictogram}`)
}
// วลียาวต้องมาก่อนวลีสั้นที่เป็นส่วนย่อยของมัน ไม่งั้นการตัดข้อความจะจับผิดวลี
for (let outer = 0; outer < THAI_GHS_CLASSES.length; outer += 1) {
  for (let inner = outer + 1; inner < THAI_GHS_CLASSES.length; inner += 1) {
    assert.ok(
      !THAI_GHS_CLASSES[outer].phraseTh.includes(THAI_GHS_CLASSES[inner].phraseTh) === false
        || !THAI_GHS_CLASSES[inner].phraseTh.includes(THAI_GHS_CLASSES[outer].phraseTh),
      `phrase order breaks longest-first: ${THAI_GHS_CLASSES[outer].phraseTh} / ${THAI_GHS_CLASSES[inner].phraseTh}`,
    )
  }
}

// ── การซ่อมข้อความที่เสียจากการสกัด PDF ─────────────────────────────────────
assert.equal(normalizeThaiHazardText('พิษเฉียบพลัน (มีความเป็นพิษต ่า)'), 'พิษเฉียบพลัน (มีความเป็นพิษต่ำ)')
assert.equal(normalizeThaiHazardText('สารทีกัดกร่อนโลหะ'), 'สารที่กัดกร่อนโลหะ')
assert.equal(normalizeThaiHazardText('ของแข็งไม่ก่าหนดประเภท'), 'ของแข็งไม่กำหนดประเภท')
assert.equal(
  normalizeThaiHazardText('ความ เป็นอันตรายต่อสิงแวดล้อมทางน ่า'),
  'ความเป็นอันตรายต่อสิ่งแวดล้อมทางน้ำ',
)
assert.equal(normalizeThaiHazardText(null), '')

// ── ทุกแถวของ master list ต้องแปลได้หมด ห้ามเหลือเศษ ────────────────────────
assert.equal(JUNE_2026_MASTERLIST_ROWS.length, 25)
for (const row of JUNE_2026_MASTERLIST_ROWS) {
  const parsed = parseThaiGhsText(row.rawGhsText)
  assert.deepEqual(parsed.unmatched, [], `row ${row.no} (${row.chemicalName}) left: ${parsed.unmatched.join(' | ')}`)
  assert.ok(parsed.hazardClasses.length > 0, `row ${row.no} produced no hazard class`)
}

function pictogramsForRow(no: number) {
  const row = JUNE_2026_MASTERLIST_ROWS.find(item => item.no === no)
  assert.ok(row, `missing row ${no}`)
  return parseThaiGhsText(row.rawGhsText).pictogramCodes
}

// 70 % alcohol — ก๊าซไวไฟ + พิษเฉียบพลัน (ต่ำ)
assert.deepEqual(pictogramsForRow(1), ['GHS02', 'GHS07'])
// Ammonia solution 25% — กัดกร่อนโลหะ + พิษเฉียบพลัน (ต่ำ) + สิ่งแวดล้อมทางน้ำ
assert.deepEqual(pictogramsForRow(4), ['GHS05', 'GHS07', 'GHS09'])
// Formalin — ก๊าซไวไฟ + พิษเฉียบพลัน (สูง) + อันตรายต่อสุขภาพ + กัดกร่อนโลหะ
assert.deepEqual(pictogramsForRow(12), ['GHS02', 'GHS05', 'GHS06', 'GHS08'])
// Sodium acetate (anhydrous) — ของแข็งไม่กำหนดประเภท จึงไม่มีสัญลักษณ์ แต่ต้องมีการจำแนก
assert.deepEqual(pictogramsForRow(21), [])
assert.deepEqual(
  parseThaiGhsText(JUNE_2026_MASTERLIST_ROWS[20].rawGhsText).hazardClasses.map(item => item.classTh),
  ['ของแข็งไม่กำหนดประเภท'],
)
// Wright’s Baso — ก๊าซไวไฟ อย่างเดียว
assert.deepEqual(pictogramsForRow(24), ['GHS02'])

// "พิษเฉียบพลัน (มีความเป็นพิษสูง)" ต้องไม่ถูกจับเป็น GHS07 ของวลีพิษต่ำ
assert.deepEqual(parseThaiGhsText('พิษเฉียบพลัน (มีความเป็นพิษสูง)').pictogramCodes, ['GHS06'])
assert.deepEqual(parseThaiGhsText('พิษเฉียบพลัน (มีความเป็นพิษต่ำ)').pictogramCodes, ['GHS07'])

// ── ข้อความที่ไม่รู้จักต้องถูกรายงาน ไม่ใช่ถูกกลืน ──────────────────────────
const unknown = parseThaiGhsText('ก๊าซไวไฟ และ สารกัมมันตรังสี')
assert.deepEqual(unknown.pictogramCodes, ['GHS02'])
assert.deepEqual(unknown.unmatched, ['สารกัมมันตรังสี'])
assert.throws(() => parseThaiGhsTextOrThrow('ก๊าซไวไฟ และ สารกัมมันตรังสี', 'row 99'), /Unrecognized Thai GHS phrase/)
assert.doesNotThrow(() => parseThaiGhsTextOrThrow('ก๊าซไวไฟ', 'row 1'))

console.log('chemical-safety ghs: ok')
