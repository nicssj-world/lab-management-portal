import { strict as assert } from 'node:assert'
import { createUserSchema, updateUserSchema } from './user-schema'
import { PersonnelProfileSchema } from './personnel'

const schemas = [
  ['create user', createUserSchema.pick({ name_prefix: true })],
  ['update user', updateUserSchema.pick({ name_prefix: true })],
  ['personnel profile', PersonnelProfileSchema.pick({ name_prefix: true })],
] as const

for (const [label, schema] of schemas) {
  for (const value of ['นาย', 'น.ส.', 'นาง'] as const) {
    const result = schema.safeParse({ name_prefix: value })
    assert.equal(result.success, true, `${label} should accept ${value}`)
  }
  const empty = schema.safeParse({ name_prefix: '' })
  assert.equal(empty.success, true, `${label} should accept empty value`)
  if (empty.success) assert.equal(empty.data.name_prefix, null, `${label} should normalize empty value`)
  assert.equal(schema.safeParse({ name_prefix: null }).success, true, `${label} should accept null`)
  assert.equal(schema.safeParse({ name_prefix: 'ดร.' }).success, false, `${label} should reject unsupported prefix`)
}

console.log('lib/validations/name-prefix.test.ts: all assertions passed')
