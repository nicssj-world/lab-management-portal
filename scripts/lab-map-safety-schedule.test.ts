import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { nextSafetyInspectionDate, SAFETY_INSPECTION_INTERVAL_DAYS, SAFETY_INSPECTION_SCHEDULE_LABEL } from '../lib/lab-map/safety-inspection-schedule'

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const desktop = read('components/lab-map/SafetyAssetsClient.tsx')
const mobile = read('components/lab-map/SafetyInspectionMobile.tsx')
const validation = read('lib/validations/lab-map-safety.ts')
const route = read('app/api/admin/lab-map/safety-assets/[id]/inspection-photo/route.ts')
const migration = read('supabase/migrations/20260818213435_auto_schedule_safety_inspections.sql')

assert.equal(SAFETY_INSPECTION_INTERVAL_DAYS, 30)
assert.equal(SAFETY_INSPECTION_SCHEDULE_LABEL, 'ตรวจครั้งถัดไป (ระบบกำหนดทุก 30 วัน)')
assert.equal(nextSafetyInspectionDate('2026-08-18'), '2026-09-17')
assert.equal(nextSafetyInspectionDate('2024-02-01'), '2024-03-02')
assert.equal(nextSafetyInspectionDate('2024-02-10'), '2024-03-11')
assert.throws(() => nextSafetyInspectionDate('2026-02-31'), /วันที่ตรวจไม่ถูกต้อง/)

assert.match(desktop, /nextSafetyInspectionDate/)
assert.match(desktop, /SAFETY_INSPECTION_SCHEDULE_LABEL/)
assert.match(desktop, /value=\{nextDate\} readOnly disabled/)
assert.doesNotMatch(desktop, /value=\{nextDate\}\s+onChange/)

assert.match(mobile, /nextSafetyInspectionDate/)
assert.match(mobile, /SAFETY_INSPECTION_SCHEDULE_LABEL/)
assert.match(mobile, /value=\{nextInspectionDate\} readOnly disabled/)
assert.doesNotMatch(mobile, /value=\{nextInspectionDate\}\s+onChange/)
assert.doesNotMatch(validation, /nextInspectionDate:/)
assert.match(route, /const nextInspectionDate = nextSafetyInspectionDate\(parsed\.data\.inspectedOn\)/)
assert.match(route, /p_next_inspection_date: nextInspectionDate/)
assert.match(migration, /SET next_inspection_date = inspected_on \+ 30/)
assert.match(migration, /NEW\.next_inspection_date := NEW\.inspected_on \+ 30/)
assert.match(migration, /CREATE TRIGGER lab_map_safety_inspections_auto_schedule/)

console.log('lab map safety inspection schedule contract passed')
