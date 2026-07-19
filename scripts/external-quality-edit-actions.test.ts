import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

assert.equal(existsSync('components/external-quality/RecordEditDialog.tsx'), true, 'shared edit dialog exists')

const outlab = readFileSync('components/outlab/OutlabDashboard.tsx', 'utf8')
const eqa = readFileSync('components/eqa/EqaDashboard.tsx', 'utf8')

for (const source of [outlab, eqa]) {
  assert.ok(source.includes('RecordEditDialog'), 'renders a reusable edit dialog')
  assert.ok(source.includes('แก้ไข'), 'offers an edit action')
  assert.ok(source.includes('ลบ') || source.includes('ปิดใช้งาน'), 'offers a removal/deactivation action')
  assert.equal(source.includes('>จัดการห้องปฏิบัติการ<') || source.includes('>จัดการผู้ให้บริการ EQA<'), false, 'does not duplicate record management above the lists')
  assert.ok(source.includes('จัดการระบบ'), 'offers system management from the overview')
  assert.equal(source.includes("['settings', 'ผู้แก้ไข']"), false, 'does not render the editor settings as a tab')
}

assert.ok(outlab.includes('<th>จัดการ</th>'), 'OUTLAB actions live in the registry tables')
assert.ok(eqa.includes('<th>จัดการ</th>'), 'EQA actions live in the registry tables')
assert.ok(outlab.includes('/api/admin/outlab/laboratories/${'))
assert.ok(outlab.includes('/api/admin/outlab/services/${'))
assert.ok(outlab.includes('/api/admin/outlab/certificates/${'))
assert.ok(eqa.includes('/api/admin/eqa/providers/${'))
assert.ok(eqa.includes('/api/admin/eqa/programs/${'))
assert.ok(eqa.includes('/api/admin/eqa/capas/${'))
assert.ok(eqa.includes('/api/admin/eqa/rounds/${result.round_id}/results?resultId=${result.id}'), 'offers a delete action for an EQA result')

console.log('scripts/external-quality-edit-actions.test.ts: all assertions passed')
