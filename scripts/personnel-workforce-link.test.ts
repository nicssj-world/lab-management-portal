import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('app/(protected)/staff/personnel/PersonnelClient.tsx'), 'utf8')

assert.doesNotMatch(source, /href="\/staff\/personnel\/workforce"/)
assert.doesNotMatch(source, /Dashboard อัตรากำลัง/)
