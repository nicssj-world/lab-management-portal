import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx', 'utf8')
const block = source.match(/const POSITION_OPTIONS\s*=\s*\[([\s\S]*?)\r?\n\]/)
const optionsBody = block?.[1] ?? ''
assert.ok(optionsBody, 'POSITION_OPTIONS must remain declared in the personnel detail client')

const positions = [...optionsBody.matchAll(/'([^']+)'/g)].map((match) => match[1])
assert.deepEqual(positions, [
  'นักเทคนิคการแพทย์',
  'นักเทคนิคการแพทย์ปฏิบัติการ',
  'นักเทคนิคการแพทย์ชำนาญการ',
  'นักเทคนิคการแพทย์ชำนาญการพิเศษ',
  'จพง.วิทยาศาสตร์การแพทย์ชำนาญงาน',
  'จพง.วิทยาศาสตร์การแพทย์ปฏิบัติงาน',
  'พนักงานประจำห้องทดลอง',
  'พนักงานบริการ',
  'นายแพทย์เชี่ยวชาญ',
])

assert.match(
  source,
  /optionsWithCurrent\(POSITION_OPTIONS, form\.position_title\)\.map/,
  'the position select must render POSITION_OPTIONS',
)

console.log('scripts/personnel-position-options.test.ts: all assertions passed')
