import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const collection = read('app/api/admin/lab-map/assembly-points/route.ts')
const item = read('app/api/admin/lab-map/assembly-points/[id]/route.ts')
const photo = read('app/api/admin/lab-map/assembly-points/[id]/verification-photo/route.ts')
const history = read('app/api/admin/lab-map/assembly-points/[id]/verifications/route.ts')
const stream = read('app/api/admin/lab-map/assembly-verifications/[id]/photo/route.ts')

for (const source of [collection, item, photo, history, stream]) assert.match(source, /requireSafety/)
assert.match(collection, /assemblyPointInputSchema/)
assert.match(collection, /lab_map_assembly_point_exits/)
assert.match(collection, /point_type/)
assert.match(item, /assemblyPointPatchSchema/)
assert.match(item, /point_type/)
assert.match(item, /position_status/)
assert.match(item, /status: 409/)
assert.match(photo, /assemblyVerificationFinalizeSchema/)
assert.match(photo, /latitude/)
assert.match(photo, /longitude/)
assert.match(photo, /isAllowedFileSignature/)
assert.match(photo, /DeleteObjectCommand/)
assert.match(stream, /r2ObjectResponse/)

console.log('lab map assembly point API contract passed')
