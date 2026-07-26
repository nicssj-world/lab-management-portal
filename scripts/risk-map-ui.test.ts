import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const page = read('app/(protected)/staff/risk/map/page.tsx')
const client = read('components/risk/RiskMapClient.tsx')
const api = read('app/api/admin/risk/map/route.ts')
const navigation = read('lib/navigation.ts')
const incidentValidation = read('lib/validations/incident.ts')
const registerValidation = read('lib/validations/risk-register.ts')
const incidentForm = read('components/risk/IncidentReportForm.tsx')
const registerForm = read('components/risk/RegisterFormModal.tsx')
const incidentList = read('components/risk/IncidentClient.tsx')
const registerList = read('components/risk/RegisterClient.tsx')

assert.match(page, /requireRiskAccess/)
assert.match(client, /^'use client'/)
assert.match(client, /incidents/)
assert.match(client, /register/)
assert.match(client, /12 เดือน/)
assert.match(client, /LabMapCanvas/)
assert.match(api, /aggregateIncidentMap/)
assert.match(api, /aggregateRegisterMap/)
assert.match(api, /space_code/)
assert.match(api, /deleted_at/)
assert.match(navigation, /\/staff\/risk\/map/)
assert.match(incidentValidation, /space_code/)
assert.match(registerValidation, /space_code/)
assert.match(incidentForm, /space_code/)
assert.match(registerForm, /space_code/)
assert.match(incidentList, /spaceCode/)
assert.match(incidentList, /fromDate/)
assert.match(registerList, /spaceCode/)
assert.match(registerList, /active/)
assert.match(api, /requestedLevel/)

// ── กันบั๊กแผนที่ดำสนิท: --map-* ประกาศอยู่ใต้ .lab-map-shell เท่านั้น ──
// ถ้า LabMapCanvas ไม่ได้อยู่ใต้ wrapper นี้ ตัวแปรสีจะว่างเปล่า SVG fill จึงตกกลับไปเป็นสีดำทั้งพื้น
assert.match(client, /<LabMapStyles \/>/, 'renders LabMapStyles so --map-* tokens resolve')
assert.match(client, /className="lab-map-shell/, 'wraps its canvas in .lab-map-shell so tokens cascade to it')

console.log('risk map UI contract passed')
