import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const routePath = 'app/api/admin/safety-tasks/monthly-form-templates/route.ts'
assert.ok(existsSync(join(process.cwd(), routePath)), 'monthly form template API exists')
const route = read(routePath)
assert.ok(route.includes("safetyTaskContext('edit')"), 'template registry is editor-only')
assert.ok(route.includes('createMonthlySafetyFormTemplate'), 'registry creates immutable versions')
assert.ok(route.includes('activateMonthlySafetyFormTemplate'), 'registry activates an approved version')
const server = read('lib/quality-tasks/monthly-safety-template-server.ts')
assert.ok(server.includes('version') && server.includes('retired_at'), 'template history is versioned and retired')
assert.ok(server.includes('chemical_spill_kit'), 'Chemical Spill Kit is managed explicitly')
const ui = read('components/safety-tasks/MonthlySafetyTemplateRegistry.tsx')
for (const label of ['แม่แบบแบบตรวจรายเดือน', 'Biohazard', 'Chemical', 'NSS', 'สร้าง Version ใหม่', 'เปิดใช้งาน Version นี้']) assert.ok(ui.includes(label), `registry renders ${label}`)
assert.ok(read('components/safety-tasks/SafetyTaskRegistry.tsx').includes('MonthlySafetyTemplateRegistry'), 'template registry is mounted in Safety Registry')

console.log('monthly safety template registry passed')
