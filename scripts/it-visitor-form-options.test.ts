import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeVisitorFormConfig } from '@/lib/it-visitor/form-config'
import { validateVisitorSubmission } from '@/lib/it-visitor/validation'
import type { VisitorSubmissionInput } from '@/lib/it-visitor/types'

const defaults = normalizeVisitorFormConfig({})
assert.deepEqual(defaults.safety_options.map((option) => option.id), ['acknowledged', 'declined'])
assert.ok(defaults.safety_policy_prompt.length > 0)

const configured = normalizeVisitorFormConfig({
  activity_options: [{ id: 'custom_activity_1', label: 'ตรวจรับงาน' }],
  contact_dept_options: [{ id: 'custom_dept_1', label: 'งานพัสดุ' }],
  safety_policy_prompt: 'ยืนยันการปฏิบัติตามข้อกำหนดความปลอดภัยหรือไม่',
  safety_options: [
    { id: 'acknowledged', label: 'รับทราบและปฏิบัติตาม', outcome: 'declined' },
    { id: 'declined', label: 'ไม่ยินยอม', outcome: 'acknowledged' },
    { id: 'custom_safety_1', label: 'ไม่เกี่ยวข้อง', outcome: 'acknowledged' },
  ],
})
assert.equal(configured.safety_policy_prompt, 'ยืนยันการปฏิบัติตามข้อกำหนดความปลอดภัยหรือไม่')
assert.equal(configured.safety_options[0].outcome, 'acknowledged', 'standard acknowledged outcome is immutable')
assert.equal(configured.safety_options[1].outcome, 'declined', 'standard declined outcome is immutable')
assert.equal(configured.safety_options[2].label, 'ไม่เกี่ยวข้อง')

const deletable = normalizeVisitorFormConfig({
  safety_options: [{ id: 'custom_safety_2', label: 'ไม่มีความเสี่ยง', outcome: 'acknowledged' }],
})
assert.deepEqual(deletable.safety_options.map((option) => option.id), ['custom_safety_2'], 'explicitly removed standard options stay removed')

const base: VisitorSubmissionInput = {
  visit_type: 'individual',
  visit_date: '2026-08-20',
  visitor_name: 'ผู้มาติดต่อ',
  head_count: 0,
  phone: '0812345678',
  org_type: 'external',
  org_name: 'บริษัทตัวอย่าง',
  contact_dept: 'งานพัสดุ',
  entered_at: new Date('2026-08-20T09:00:00Z').toISOString(),
  activity_type: 'other',
  activity_other: 'ตรวจรับงาน',
  appointment: 'booked',
  badge_exchanged: 'yes',
  safety_ack: 'acknowledged',
  safety_ack_other: 'ไม่เกี่ยวข้อง',
}
const validated = validateVisitorSubmission(base, new Date('2026-08-20T10:00:00Z').getTime())
assert.equal(validated.ok, true)
assert.equal(validated.ok && validated.row.safety_ack_other, 'ไม่เกี่ยวข้อง')

const publicForm = fs.readFileSync('components/it-visitor/PublicVisitorForm.tsx', 'utf8')
const editor = fs.readFileSync('components/it-visitor/VisitorFormOptionsEditor.tsx', 'utf8')
const settingsRoute = fs.readFileSync('app/api/admin/it-visitors/settings/route.ts', 'utf8')
const staffClient = fs.readFileSync('app/(protected)/staff/it/visitors/ItVisitorsClient.tsx', 'utf8')
const migration = fs.readFileSync('scripts/it-visitor-form-options.sql', 'utf8')
assert.match(publicForm, /safety_policy_prompt/)
assert.match(publicForm, /safety_options/)
assert.match(editor, /เพิ่มตัวเลือกนโยบายความปลอดภัย/)
assert.match(staffClient, /isAdmin && .*แก้ไขฟอร์มสาธารณะ/)
assert.match(settingsRoute, /canManageVisitorFormSettings/)
assert.match(settingsRoute, /setVisitorFormConfig/)
assert.match(migration, /form_config/i)
assert.match(migration, /safety_ack_other/i)

console.log('IT visitor form option tests passed')
