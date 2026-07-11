import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseNumberedSpecimenText } from '../components/tests/SpecimenSection'

const rejectText = [
  '1. ตัวอย่างส่งตรวจและใบส่งตรวจ มีข้อมูลไม่ตรงกัน',
  '2. Tube แตก รั่ว หรือมีสัญญาณของการปนเปื้อน',
  '8. Plasma หรือ serum ที่เก็บที่ 2-8°C นานเกิน 6 วัน หรือที่ ≤-18°C นานเกิน 12',
  'สัปดาห์ นับจากวันที่',
  'แยกตัวอย่าง',
  '9. ตัวอย่างส่งตรวจที่มี hemolysis, lipemia หรือ icterus รุนแรง',
].join('\n')

const parsed = parseNumberedSpecimenText(rejectText)

assert.ok(parsed, 'numbered rejection criteria should be parsed as a list')
assert.equal(parsed?.length, 4)
assert.deepEqual(parsed?.[2], {
  value: 8,
  text: 'Plasma หรือ serum ที่เก็บที่ 2-8°C นานเกิน 6 วัน หรือที่ ≤-18°C นานเกิน 12 สัปดาห์ นับจากวันที่ แยกตัวอย่าง',
})

assert.equal(
  parseNumberedSpecimenText('เก็บที่อุณหภูมิ 2-25°C ไม่ควรเกิน 24 ชั่วโมง'),
  null,
  'plain specimen text should keep the normal multiline renderer',
)

const source = readFileSync('components/tests/SpecimenSection.tsx', 'utf8')
assert.match(source, /className="specimen-numbered-list"/, 'numbered specimen text should use a dedicated list class')
assert.match(source, /<ol/, 'numbered rejection criteria should render as an ordered list')
assert.match(source, /className="specimen-numbered-marker"/, 'numbers should be rendered as visible text, not only browser list markers')
assert.match(source, /\{item\.value\}\./, 'each numbered item should print its original number explicitly')
assert.match(source, /list-style:\s*none/, 'browser markers should be disabled after explicit numbers are rendered')
assert.match(source, /whiteSpace:\s*'normal'/, 'numbered text should not preserve accidental source line breaks')

console.log('specimen section format tests passed')
