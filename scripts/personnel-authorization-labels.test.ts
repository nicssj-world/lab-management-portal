import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const detail = readFileSync(resolve('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx'), 'utf8')
const manage = readFileSync(resolve('app/(protected)/staff/personnel/manage/ManageClient.tsx'), 'utf8')

assert.match(detail, /th: 'สิทธิ์การตรวจ'/)
assert.match(detail, /title="สิทธิ์ปฏิบัติงานตรวจ"/)
assert.match(detail, /addLabel="กำหนดสิทธิ์การตรวจ"/)
assert.match(detail, /title="สิทธิ์การตรวจ"/)
assert.match(manage, /authorizations: 'กำหนดสิทธิ์การตรวจ'/)
