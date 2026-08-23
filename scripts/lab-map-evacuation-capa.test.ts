import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const client = read('components/lab-map/EvacuationClient.tsx')
const server = read('lib/quality-tasks/server.ts')
const safetyRoute = read('app/api/admin/safety-tasks/occurrences/[id]/action-items/route.ts')

assert.match(client, /action-items/, 'โมดูลแผนอพยพต้องอ่าน/เขียน action item จากงานเดิม')
assert.match(client, /สร้าง CAPA|CAPA/, 'ผลเบี่ยงเบนต้องมีจุดสร้าง CAPA')
assert.match(client, /evacuation_drill_session/, 'CAPA ต้องระบุ source ของ session ที่เป็นต้นเหตุ')
assert.match(server, /source_type|sourceType/, 'quality action item ต้องเก็บ source type')
assert.match(server, /source_id|sourceId/, 'quality action item ต้องเก็บ source id')
assert.match(safetyRoute, /sourceType|source_type/, 'safety action-item API ต้องรองรับการกรอง/สร้าง source ของ evacuation')

console.log('evacuation CAPA contract passed')
