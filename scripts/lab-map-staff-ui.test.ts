import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const page = read('app/(protected)/staff/lab-map/page.tsx')
const client = read('components/lab-map/LabMapStaffClient.tsx')
const panel = read('components/lab-map/LabMapPersonnelPanel.tsx')
const form = read('components/lab-map/LabMapAssignmentForm.tsx')
const shell = read('components/lab-map/LabMapShell.tsx')

assert.ok(page.includes('getStaffLabMapDTO'))
assert.ok(page.includes('getRolePermissions'))
assert.ok(page.includes('<LabMapStaffClient'))
assert.ok(client.includes("'overview', 'infection', 'safety'"))
assert.ok(client.includes("'personnel'"))
assert.ok(!client.includes("'equipment'"))
assert.ok(shell.includes('space.nameTh') && shell.includes('space.workUnits'))
assert.ok(client.includes('people !== undefined'), 'personnel mode is permission-gated by DTO omission')
assert.ok(panel.includes('ไม่ใช่ตำแหน่งปัจจุบัน'))
assert.ok(panel.includes('ยังไม่ได้กำหนดพื้นที่'))
assert.ok(panel.includes('canEditPersonnelAssignments'))
assert.ok(form.includes('/api/admin/lab-map/person-assignments'))
assert.ok(form.includes('<select'), 'ordinary selects are used instead of drag and drop')
console.log('lab map staff UI contract passed')
