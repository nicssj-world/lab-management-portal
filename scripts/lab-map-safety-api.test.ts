import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const guard = read('lib/lab-map/safety-access.ts')
const collection = read('app/api/admin/lab-map/safety-assets/route.ts')
const item = read('app/api/admin/lab-map/safety-assets/[id]/route.ts')
const photo = read('app/api/admin/lab-map/safety-assets/[id]/inspection-photo/route.ts')
const inspections = read('app/api/admin/lab-map/safety-assets/[id]/inspections/route.ts')
const editors = read('app/api/admin/lab-map/safety-editors/route.ts')

assert.match(guard, /lab_map_safety_editors/)
assert.match(guard, /Admin/)
assert.match(guard, /Manager/)
assert.match(guard, /requireSafetyEditor/)
assert.match(guard, /requireSafetyAdmin/)
for (const source of [collection, item, photo, inspections, editors]) {
  assert.match(source, /requireSafety|requireSafetyViewer/)
}
assert.match(collection, /safetyAssetInputSchema/)
assert.match(item, /safetyAssetPatchSchema/)
assert.match(item, /updated_at/)
assert.match(item, /status: 409/)
assert.match(item, /requireSafetyManager/)
assert.match(photo, /isAllowedFileSignature/)
assert.match(photo, /10485760|SAFETY_PHOTO_MAX_BYTES/)
assert.match(photo, /DeleteObjectCommand/)
assert.match(photo, /inspectionFinalizeSchema/)
assert.match(photo, /position_status/)
assert.match(editors, /requireSafetyAdmin/)

console.log('lab map safety API contract passed')
