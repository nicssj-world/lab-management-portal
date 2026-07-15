import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const files = [
  'components/tests/TestDetailCard.tsx',
  'components/tests/TestTable.tsx',
  'components/tests/CatalogDetailModal.tsx',
  'app/(public)/catalog/[code]/page.tsx',
  'app/(protected)/staff/tests/[id]/page.tsx',
  'components/tests/TestForm.tsx',
]

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  assert.match(source, /วัน-เวลาที่ตรวจ/, `${file} should use the shorter service-time label`)
  assert.doesNotMatch(source, /วัน-เวลาที่ตรวจวิเคราะห์/, `${file} should not use the longer service-time label`)
}

console.log('service time label tests passed')
