import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const detail = readFileSync(resolve('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx'), 'utf8')

assert.match(detail, /AuthorizationMultiSelect/)
assert.match(detail, /role_types/)
assert.match(detail, /categories/)
assert.match(detail, /authorizations\/batch/)
assert.match(detail, /จะสร้างสิทธิ์/)

const manage = readFileSync(resolve('app/(protected)/staff/personnel/manage/ManageClient.tsx'), 'utf8')
assert.match(manage, /AuthorizationMultiSelect/)
assert.match(manage, /authorizationCategories/)
assert.match(manage, /authorizationRoles/)
assert.match(manage, /สิทธิ์ที่จะสร้าง/)
