import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const routePath = 'app/api/admin/lab-map/safety-assets/[id]/monthly-profile/route.ts'
assert.ok(existsSync(join(process.cwd(), routePath)), 'monthly profile asset route exists')
const route = read(routePath)
assert.ok(route.includes('requireSafetyEditor'), 'only Safety Editor can update monthly inspection configuration')
assert.ok(route.includes('monthlySafetyAssetConfigSchema'), 'profile, assignees and inventory are validated')
assert.ok(route.includes('saveMonthlySafetyAssetConfig'), 'route persists versioned asset configuration')

const server = read('lib/quality-tasks/monthly-safety-config-server.ts')
for (const token of ['active_from', 'active_to', 'activated_on', 'retired_on', 'replacement_for_id', 'audit_log']) {
  assert.ok(server.includes(token), `asset config preserves ${token}`)
}
const ui = read('components/lab-map/SafetyAssetsClient.tsx')
for (const label of ['Profile ตรวจประจำเดือน', 'ผู้รับผิดชอบหลัก', 'ผู้รับผิดชอบสำรอง', 'Inventory / ขวด NSS', 'เริ่มใช้']) {
  assert.ok(ui.includes(label), `Safety Asset detail includes ${label}`)
}

console.log('monthly safety asset configuration passed')
