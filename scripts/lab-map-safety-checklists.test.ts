import assert from 'node:assert/strict'
import { SAFETY_EQUIPMENT_KINDS } from '../lib/lab-map/safety-domain'
import {
  checklistForSafetyKind,
  validateChecklistCompletion,
} from '../lib/lab-map/safety-inspection-checklists'

for (const kind of SAFETY_EQUIPMENT_KINDS) {
  const checklist = checklistForSafetyKind(kind)
  assert.ok(checklist.length >= 3, `${kind} needs at least three field checks`)
  assert.equal(new Set(checklist.map(item => item.key)).size, checklist.length)
  assert.equal(checklist.every(item => item.required), true)
}

const extinguisher = checklistForSafetyKind('fire-extinguisher')
assert.deepEqual(extinguisher.map(item => item.key), [
  'accessible', 'seal-pin', 'pressure', 'hose-nozzle', 'body-condition', 'expiry-label',
])
assert.deepEqual(validateChecklistCompletion(extinguisher, []), {
  valid: false,
  missingKeys: extinguisher.map(item => item.key),
})
assert.deepEqual(validateChecklistCompletion(extinguisher, extinguisher.map(item => ({
  key: item.key, labelTh: item.labelTh, answer: 'pass' as const, note: null,
}))), { valid: true, missingKeys: [] })

console.log('lab map safety checklist tests passed')
