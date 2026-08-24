import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20260824100000_personnel_name_prefix.sql')
const detail = read('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx')
const detailPage = read('app/(protected)/staff/personnel/[id]/page.tsx')
const admin = read('app/(protected)/staff/admin/AdminUserClient.tsx')

assert.match(migration, /ADD COLUMN IF NOT EXISTS name_prefix text/)
assert.match(migration, /name_prefix IN \('นาย', 'น\.ส\.', 'นาง'\)/)
assert.match(detail, /name_prefix: prof\.name_prefix \?\? ''/)
assert.match(detail, /<Field label="คำนำหน้าชื่อ">/)
assert.match(detail, /formatProfileName\(prof\.name, prof\.name_prefix\)/)
assert.match(detailPage, /select\('id, name, name_prefix'\)/)
assert.match(admin, /name_prefix: user\?\.name_prefix \?\? ''/)
assert.match(admin, /<Field label="คำนำหน้าชื่อ">/)
assert.match(admin, /name_prefix: form\.name_prefix/)
assert.match(admin, /formatProfileName\(user\.name, user\.name_prefix\)/)

console.log('scripts/personnel-name-prefix.test.ts: all assertions passed')
