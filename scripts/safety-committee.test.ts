import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const access = read('lib/lab-map/safety-access.ts')
const safetyPage = read('app/(protected)/staff/safety/page.tsx')
const safetyHub = read('components/safety-tasks/SafetyTaskHub.tsx')
const committee = read('components/safety-tasks/SafetyCommitteeManager.tsx')
const safetyAssets = read('components/lab-map/SafetyAssetsClient.tsx')
const editorApi = read('app/api/admin/lab-map/safety-editors/route.ts')

assert.ok(
  existsSync(join(process.cwd(), 'components/safety-tasks/SafetyCommitteeManager.tsx')),
  'คณะทำงานความปลอดภัยต้องถูกย้ายมาเป็น component ของหน้างานและหลักฐาน',
)
assert.match(safetyHub, /SafetyCommitteeManager/, 'หน้างานและหลักฐานต้องเป็นเจ้าของ UI จัดการคณะทำงาน')
assert.match(safetyHub, /คณะทำงานความปลอดภัย/, 'หัวหน้าต้องมีปุ่มชื่อใหม่')
assert.match(safetyHub, /ทะเบียนอุปกรณ์[\s\S]{0,700}คณะทำงานความปลอดภัย/, 'ปุ่มคณะทำงานต้องอยู่ข้างทะเบียนอุปกรณ์')
assert.match(committee, /สมาชิกจากผู้ใช้ในโปรเจกต์/, 'ตัวเลือกสมาชิกต้องอ้างอิงผู้ใช้ทั้งหมดในโปรเจกต์')
assert.doesNotMatch(committee, /responsibility|ตำแหน่งในคณะทำงาน|กำหนดตำแหน่ง/, 'คณะทำงานไม่ต้องกำหนดตำแหน่งแยก')
assert.doesNotMatch(safetyAssets, /type Tab = 'assets' \| 'assembly' \| 'editors'/, 'ทะเบียนอุปกรณ์ต้องไม่เป็นเจ้าของแท็บผู้รับผิดชอบอีกต่อไป')
assert.doesNotMatch(safetyAssets, /safety-responsible/, 'สไตล์/โครงสร้างเดิมของผู้รับผิดชอบต้องไม่ค้างในหน้าทะเบียน')
assert.match(safetyPage, /initialEditors/, 'หน้าความปลอดภัยต้องโหลดสมาชิกคณะทำงานให้ dialog')
assert.match(safetyPage, /isAdmin/, 'การจัดการสมาชิกยังจำกัดเฉพาะ Admin ระบบ')
assert.doesNotMatch(editorApi, /responsibilityTitle|responsibility_title/, 'API ต้องไม่เก็บตำแหน่งแยกของคณะทำงาน')
assert.match(safetyHub, /canManage/, 'dialog ต้องแยกโหมดดูอย่างเดียวกับโหมดจัดการ')

assert.match(access, /export async function isSafetyManager/, 'guard ระดับจัดการความปลอดภัยต้องรองรับการตรวจสมาชิกจากฐานข้อมูล')
assert.match(access, /lab_map_safety_editors/, 'สิทธิ์คณะทำงานต้องผูกกับตารางเดิม')
assert.match(access, /isSafetyManager\(actor\)/, 'Safety Editor และ Safety Manager ต้องใช้ขอบเขตสมาชิกชุดเดียวกัน')
assert.match(safetyPage, /select\('id, name, role'\)\.is\('deleted_at', null\)\.order\('name'\)/, 'Admin ต้องเห็นผู้ใช้ที่ยังใช้งานทั้งหมดในโปรเจกต์สำหรับเลือกสมาชิก')
assert.match(editorApi, /\.is\('deleted_at', null\)/, 'API ต้องไม่แสดงหรือมอบสิทธิ์ให้บัญชีที่ถูก soft-delete')
assert.match(safetyHub, /canManage=\{isAdmin\}/, 'การเปลี่ยนรายชื่อคณะทำงานยังจำกัดเฉพาะ Admin ระบบ')

console.log('scripts/safety-committee.test.ts: all assertions passed')
