import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(process.cwd(), 'components', 'risk', 'IncidentReportForm.tsx'),
  'utf8',
).replace(/\r\n/g, '\n')

assert.match(source, /pendingDraft/)
assert.match(source, /setPendingDraft/)
assert.match(source, /ใช้ร่างเดิม/)
assert.match(source, /เริ่มรายงานใหม่/)
assert.doesNotMatch(source, /setDraft\(\{ \.\.\.EMPTY, \.\.\.parsed \}\)/)

console.log('incident report draft recovery contract passed')
