import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const list = read('app/api/admin/lab-map/releases/route.ts')
const item = read('app/api/admin/lab-map/releases/[id]/route.ts')
const publish = read('app/api/admin/lab-map/releases/[id]/publish/route.ts')
const activity = read('app/(protected)/staff/activity/ActivityClient.tsx')
const sql = read('scripts/lab-map-module.sql')

for (const source of [list, item, publish]) {
  assert.ok(source.includes('getActor'), 'route authenticates')
  assert.ok(source.includes('canManageMapReleases'), 'route checks Admin/Manager')
}
assert.ok(list.includes('currentManifestHash'))
assert.ok(item.includes("status')") || item.includes("status"), 'published state is checked')
assert.ok(publish.includes('validatePublishableRelease'))
assert.ok(publish.includes('currentManifestHash'))
assert.ok(publish.includes('status: 409'))
assert.ok(publish.includes("rpc('publish_lab_map_release'"))
assert.ok(sql.includes('CREATE OR REPLACE FUNCTION publish_lab_map_release'))
for (const action of ['create', 'update', 'publish']) {
  assert.ok(`${list}\n${item}\n${publish}`.includes(`lab_map.release.${action}`))
  assert.ok(activity.includes(`lab_map.release.${action}`))
}
console.log('lab map release API contract passed')
