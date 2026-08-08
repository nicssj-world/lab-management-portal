import assert from 'node:assert/strict'
import * as tokenModule from '@/components/risk/shared/tokens'

type TokenModule = typeof tokenModule & {
  openGroupsForIncidentCategory?: (category?: string | null) => readonly string[]
}

const tokens = tokenModule as TokenModule

assert.ok(
  tokens.openGroupsForIncidentCategory,
  'openGroupsForIncidentCategory must be exported',
)
assert.deepEqual(
  tokens.openGroupsForIncidentCategory!('สั่งเลือด/ส่วนประกอบเลือดผิดคน'),
  ['blood-order'],
)
assert.deepEqual(
  tokens.openGroupsForIncidentCategory!('สิ่งส่งตรวจ clot'),
  ['specimen'],
)
assert.deepEqual(tokens.openGroupsForIncidentCategory!(null), [])
assert.deepEqual(tokens.openGroupsForIncidentCategory!('not-a-real-category'), [])

console.log('incident category selection behavior passed')
