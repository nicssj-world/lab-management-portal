import assert from 'node:assert/strict'
import * as tokenModule from '@/components/risk/shared/tokens'

type CategoryGroup = {
  id: string
  label: string
  items: readonly string[]
}

type TokenModule = typeof tokenModule & {
  INCIDENT_CATEGORY_GROUPS?: readonly CategoryGroup[]
  incidentCategoryGroupFor?: (category?: string | null) => CategoryGroup | undefined
}

const tokens = tokenModule as TokenModule

assert.ok(tokens.INCIDENT_CATEGORY_GROUPS, 'INCIDENT_CATEGORY_GROUPS must be exported')
assert.ok(tokens.incidentCategoryGroupFor, 'incidentCategoryGroupFor must be exported')

const groups = tokens.INCIDENT_CATEGORY_GROUPS!
const categories = tokens.INCIDENT_CATEGORIES as readonly string[]
const expectedLabels = [
  'สิ่งส่งตรวจ/การรับตัวอย่าง',
  'การระบุตัวตน/ใบส่งตรวจ',
  'การขนส่ง/กระบวนการ',
  'ระบบ/วัสดุ/อื่นๆ',
  'คำสั่งการใช้เลือดคลาดเคลื่อน',
  'การจ่ายเลือดคลาดเคลื่อน',
  'การบริหารเลือดคลาดเคลื่อน',
]
const expectedBloodCategories = [
  'สั่งเลือด/ส่วนประกอบเลือดผิดจำนวน',
  'สั่งเลือด/ส่วนประกอบเลือดผิดชนิด/ไม่ตรงชนิด',
  'สั่งเลือด/ส่วนประกอบเลือดผิดคน',
  'จ่ายเลือด/ส่วนประกอบเลือดล่าช้า',
  'จ่ายเลือด/ส่วนประกอบเลือดผิดจำนวน/ชนิด',
  'จ่ายเลือด/ส่วนประกอบเลือดผิดคน',
  'ไม่ให้เลือด/ส่วนประกอบเลือด',
  'เกิดปฏิกิริยาหลังให้เลือด',
  'เกิดปฏิกิริยาหลังให้เลือดรุนแรง',
  'ให้เลือดผิดหมู่',
]

assert.deepEqual(groups.map(group => group.label), expectedLabels)
assert.equal(groups.length, 7)
assert.equal(categories.length, 28)
assert.equal(new Set(categories).size, 28)
assert.deepEqual(
  [...categories],
  groups.flatMap(group => [...group.items]),
)
for (const category of expectedBloodCategories) {
  assert.ok(categories.includes(category), 'missing category: ' + category)
}
assert.equal(
  tokens.incidentCategoryGroupFor!('สั่งเลือด/ส่วนประกอบเลือดผิดคน')?.id,
  'blood-order',
)
assert.equal(tokens.incidentCategoryGroupFor!('not-a-real-category'), undefined)

console.log('incident category groups passed')
