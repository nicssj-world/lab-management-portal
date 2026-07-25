import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const collection = read('app/api/admin/lab-map/person-assignments/route.ts')
const item = read('app/api/admin/lab-map/person-assignments/[id]/route.ts')
const activity = read('app/(protected)/staff/activity/ActivityClient.tsx')
const server = read('lib/lab-map/personnel-server.ts')

assert.ok(collection.includes("requireResource('บุคลากร', 'edit')"))
assert.ok(item.includes("requireResource('บุคลากร', 'edit')"))
assert.ok(collection.includes('personAssignmentInputSchema.safeParse'))
assert.ok(item.includes('personAssignmentInputSchema.safeParse'))
for (const source of [collection, item]) {
  assert.ok(source.includes('resolveAssignmentTarget'), 'confirms a manifest and database target')
  assert.ok(source.includes('await supabaseAdmin'), 'audit/admin operations are awaited')
}
assert.ok(server.includes("from('profiles')"), 'confirms an active profile')
assert.ok(server.includes("from('audit_log')"), 'writes audit log')
for (const action of ['create', 'update', 'delete']) {
  assert.ok(`${collection}\n${item}`.includes(`lab_map.person_assignment.${action}`))
  assert.ok(activity.includes(`lab_map.person_assignment.${action}`))
}
assert.ok(item.includes('await params'))
assert.ok(item.includes('before'))
assert.ok(!`${collection}\n${item}`.includes('phone'), 'audit/API projection excludes sensitive profile data')
console.log('lab map personnel API contract passed')
