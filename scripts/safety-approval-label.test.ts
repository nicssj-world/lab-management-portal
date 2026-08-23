import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const registry = read('components/safety-tasks/SafetyTaskRegistry.tsx')
const hub = read('components/safety-tasks/SafetyTaskHub.tsx')
const labels = `${registry}\n${hub}`

assert.match(registry, /item\.approvalMode === 'required' \? 'ต้องอนุมัติ' : 'ปิดงานได้ทันที'/, 'registry table uses the requested approval label')
assert.match(registry, /<option value="required">ต้องอนุมัติ<\/option>/, 'registry form uses the requested approval label')
assert.match(hub, /item\.template\.approvalMode === 'required' \? 'ต้องอนุมัติ' : 'ปิดงานได้เมื่อหลักฐานครบ'/, 'task details use the requested approval label')
assert.doesNotMatch(labels, /อนุมัติ 1 ขั้น|ผู้อนุมัติ 1 ขั้น/, 'old approval-step labels are removed from the safety task UI')

console.log('scripts/safety-approval-label.test.ts: all assertions passed')
