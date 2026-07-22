import assert from 'node:assert/strict'
import {
  toCeYear,
  expandTwoDigitYear,
  toValidIsoDate,
  parseSmartRmDate,
  normalizeIsoDate,
  normalizeSeverity,
  stripLabSuffix,
} from './smart-rm'

// toCeYear: BE (พ.ศ.) full year → CE (ค.ศ.)
assert.equal(toCeYear(2569), 2026)
assert.equal(toCeYear(2026), 2026) // already CE, untouched

// expandTwoDigitYear: 2-digit year → full CE year
assert.equal(expandTwoDigitYear(68), 2025) // พ.ศ. 2568 → ค.ศ. 2025
assert.equal(expandTwoDigitYear(26), 2026) // ค.ศ. 2026
assert.equal(expandTwoDigitYear(60), 2017) // pivot boundary: พ.ศ. 2560 → ค.ศ. 2017
assert.equal(expandTwoDigitYear(59), 2059) // just below pivot: ค.ศ. 2059

// toValidIsoDate: round-trips real dates, rejects calendar-invalid ones
assert.equal(toValidIsoDate(2026, 7, 31), '2026-07-31')
assert.equal(toValidIsoDate(2026, 6, 31), null) // June has 30 days
assert.equal(toValidIsoDate(1989, 12, 31), null) // outside 1990–2100 guard
assert.equal(toValidIsoDate(2101, 1, 1), null)

// parseSmartRmDate: the doc's own scenario list
assert.equal(parseSmartRmDate('31/07/2569'), '2026-07-31')
assert.equal(parseSmartRmDate('31/7/68'), '2025-07-31')
assert.equal(parseSmartRmDate('11/07/2026'), '2026-07-11')
assert.equal(parseSmartRmDate('07/31/2568'), '2025-07-31') // MM/DD entry, day/month swap recovers it
assert.equal(parseSmartRmDate('2569-07-11'), '2026-07-11')
assert.equal(parseSmartRmDate('2026-06-31'), null)
assert.equal(parseSmartRmDate(''), null)
assert.equal(parseSmartRmDate(null), null)

// Excel serial dates: unaffected by BE logic, still convert correctly, gain a sanity range guard
const julySerial = Date.UTC(2026, 6, 31) / 86400000 + 25569
assert.equal(parseSmartRmDate(julySerial), '2026-07-31')
assert.equal(parseSmartRmDate(1), null) // 1900-ish serial, outside 1990–2100 guard

// normalizeIsoDate delegates to parseSmartRmDate
assert.equal(normalizeIsoDate('31/07/2569'), '2026-07-31')

// normalizeIsoDate must be idempotent — re-normalizing its own output is a no-op
// (the real pipeline runs it once client-side for import preview, then again server-side)
const once = normalizeIsoDate('31/07/2569')
const twice = normalizeIsoDate(once)
assert.equal(twice, once)
assert.equal(twice, '2026-07-31')

console.log('  date parsing ok')

// ── normalizeSeverity: DB บังคับ A–I ค่าอื่นต้องกลายเป็น null ไม่ใช่ทำ insert ล้ม ──
assert.equal(normalizeSeverity('a'), 'A')
assert.equal(normalizeSeverity(' d '), 'D')
assert.equal(normalizeSeverity('I'), 'I')
assert.equal(normalizeSeverity('J'), null)      // นอกช่วง A–I
assert.equal(normalizeSeverity('ต่ำ'), null)     // คำไทยเป็นศัพท์ของทะเบียน ไม่ใช่ของ Smart-RM
assert.equal(normalizeSeverity(''), null)
assert.equal(normalizeSeverity(null), null)

// ── stripLabSuffix: ชื่อหน่วยงานจาก HIS มีคำต่อท้ายที่ระบบเราไม่ใช้ ──
assert.equal(stripLabSuffix('งานเคมีคลินิก กลุ่มงานเทคนิคการแพทย์'), 'งานเคมีคลินิก')
assert.equal(stripLabSuffix('งานโลหิตวิทยา (Lab)'), 'งานโลหิตวิทยา')
assert.equal(stripLabSuffix('งานคลังเลือด'), 'งานคลังเลือด')
// ตัดแล้วเหลือค่าว่างต้องคืนข้อความเดิม ไม่ใช่ทำให้หน่วยงานหายไป
assert.equal(stripLabSuffix('กลุ่มงานเทคนิคการแพทย์'), 'กลุ่มงานเทคนิคการแพทย์')
assert.equal(stripLabSuffix(''), null)

console.log('smart-rm tests passed')
