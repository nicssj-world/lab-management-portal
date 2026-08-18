import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const route = readFileSync(join(root, 'app', 'api', 'admin', 'lab-map', 'safety-assets', '[id]', 'inspection-expiry', 'route.ts'), 'utf8')
const validation = readFileSync(join(root, 'lib', 'validations', 'lab-map-safety.ts'), 'utf8')
const server = readFileSync(join(root, 'lib', 'lab-map', 'safety-server.ts'), 'utf8')
const labels = readFileSync(join(root, 'lib', 'lab-map', 'safety-domain.ts'), 'utf8')
const desktop = readFileSync(join(root, 'components', 'lab-map', 'SafetyAssetsClient.tsx'), 'utf8')
const mobile = readFileSync(join(root, 'components', 'lab-map', 'SafetyInspectionMobile.tsx'), 'utf8')
const migration = readFileSync(join(root, 'supabase', 'migrations', '20260819130000_safety_inspection_expiry_corrections.sql'), 'utf8')

assert.match(validation, /safetyInspectionExpiryCorrectionSchema/)
assert.match(validation, /expiresOn:\s*isoDate\.nullable\(\)/)
assert.match(route, /requireSafetyEditor/)
assert.match(route, /correct_lab_map_safety_inspection_expiry/)
assert.match(route, /inspectionId/)
assert.match(route, /updatedAt/)
assert.doesNotMatch(route, /inspection-photo/)
assert.match(server, /lab_map_safety_inspection_expiry_corrections/)
assert.match(server, /correctionByInspection/)
assert.match(labels, /safetyExpiryLabel/)
assert.match(desktop, /บันทึกการแก้ไข/)
assert.match(desktop, /expires === \(latestInspection\.expiresOn \?\? ''\)/)
assert.match(desktop, /บันทึกการแก้ไข.*ยืนยันผลตรวจ/)
assert.match(mobile, /บันทึกการแก้ไข/)
assert.match(mobile, /expiresOn === currentExpiresOn/)
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.lab_map_safety_inspection_expiry_corrections/i)
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.correct_lab_map_safety_inspection_expiry/i)
assert.match(migration, /expires_on date/i)

console.log('lab map safety expiry correction contract passed')
