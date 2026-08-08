// กันไม่ให้ UI ของโมดูลสารเคมีหลุดกลับไปเป็นสไตล์เดิม
//
// ก่อนหน้านี้ทั้งโมดูลไม่ใช้ components/ui/ เลยสักตัว และฝังรหัสสีตรง ๆ จำนวนมาก
// ผลคือ dark mode พังทั้งโมดูล เพราะสีที่ฝังไว้ไม่เปลี่ยนตามธีม

import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const COMPONENT_DIR = join(process.cwd(), 'components', 'chemical-safety')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const files = walk(COMPONENT_DIR).filter(path => path.endsWith('.tsx') || path.endsWith('.ts'))
assert.ok(files.length >= 6, `expected the chemical-safety component set, found ${files.length}`)

// ── ห้ามฝังรหัสสีในคอมโพเนนต์ ───────────────────────────────────────────────
// ยกเว้นสองกรณีที่จำเป็นจริง:
//   1. หน้าสาธารณะที่คุมโทน hero เอง (อยู่ใน app/(public) ไม่ใช่ที่นี่)
//   2. สีขาว/ดำล้วนที่ใช้เป็นตัวอักษรบนพื้นสีเข้มของโซนจัดเก็บ
const ALLOWED_HEX = new Set(['#fff', '#ffffff', '#000', '#000000'])
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const found = (source.match(HEX_PATTERN) ?? []).filter(hex => !ALLOWED_HEX.has(hex.toLowerCase()))
  assert.deepEqual(
    found, [],
    `${file.replace(process.cwd(), '')} ฝังรหัสสีไว้: ${found.join(', ')} — ให้ใช้ CSS variable หรือ shared/tokens.ts แทน`,
  )
}

// ── ต้องใช้ไลบรารีคอมโพเนนต์ของโปรเจค ───────────────────────────────────────
// หมายเหตุ: ไม่มี Stat ในหน้านี้อีกต่อไป — แท็บ "ภาพรวม" ถูกถอดออกตามที่ผู้ใช้ขอ
const hubSource = readFileSync(join(COMPONENT_DIR, 'ChemicalSafetyHubClient.tsx'), 'utf8')
assert.ok(hubSource.includes('chemical-unit-select'), 'ChemicalSafetyHubClient must provide a department filter select')
assert.ok(hubSource.includes('<select value={scopeFilter}'), 'department filter must remain a select control')
assert.ok(hubSource.includes('กรองตามหน่วยงาน'), 'department filter must be labelled for screen readers')
assert.ok(hubSource.includes('<select value={scopeFilter}'), 'department and chemical-room filters must share one select control')
assert.ok(hubSource.includes('<optgroup label="ห้องสารเคมี">'), 'chemical-room choices must live inside the department filter')
assert.ok(hubSource.includes('กรองตามหน่วยงาน'), 'combined owner filter must be labelled for screen readers')
assert.ok(!hubSource.includes('chemical-position-select'), 'storage position filter must be removed from the registry')
assert.ok(!hubSource.includes('กรองตามตำแหน่งจัดเก็บ'), 'storage position filter label must be removed from the registry')
for (const required of ['@/components/ui/Card', '@/components/ui/PageHeader', '@/components/ui/ViewTabs', '@/components/ui/EmptyState']) {
  assert.ok(hubSource.includes(required), `ChemicalSafetyHubClient ต้อง import ${required}`)
}
// เพิ่ม/แก้ไข/เลิกใช้งานสารเคมีต้องผ่าน workflow เสนอ→ทบทวน→อนุมัติเดิม ไม่ใช่แก้ตรงทันที
assert.ok(hubSource.includes('RegistryChangeModal'), 'ทะเบียนสารเคมีต้องมีฟอร์มเสนอเพิ่ม/แก้ไขผ่าน RegistryChangeModal')
assert.ok(hubSource.includes('ChangeRequestPanel'), 'ทะเบียนสารเคมีต้องมีแผงรอทบทวนคำขอ')
// แท็บต้องผูกกับ URL ไม่ใช่ useState ไม่งั้นแชร์ลิงก์และกดย้อนกลับไม่ได้
assert.ok(hubSource.includes('ViewTabs'), 'แท็บของหน้าห้องสารเคมีต้องใช้ ViewTabs ที่ผูกกับ ?view=')
assert.ok(hubSource.includes('openSdsEditor'), 'ทะเบียนสารเคมีต้องเปิดฟอร์มอัปโหลด SDS ได้จากแต่ละรายการ')
assert.ok(hubSource.includes("icon=\"upload\""), 'ทะเบียนสารเคมีต้องมีปุ่มอัปโหลดไฟล์ SDS')
assert.ok(hubSource.includes('สถานะการใช้งาน'), 'ทะเบียนสารเคมีต้องมีตัวกรอง/คอลัมน์สถานะการใช้งาน')
assert.ok(hubSource.includes('Active') && hubSource.includes('Inactive'), 'ทะเบียนสารเคมีต้องแสดงสถานะ Active/Inactive')
assert.ok(hubSource.includes('row.reportedTotalRaw'), 'ทะเบียนสารเคมีต้องแสดงปริมาณดิบเมื่อหน่วยจากแบบสำรวจไม่ใช่หน่วยมาตรฐาน')
assert.ok(hubSource.includes('Export Excel'), 'ทะเบียนสารเคมีต้องเลือก export เป็น Excel ได้')
assert.ok(hubSource.includes('Export PDF'), 'ทะเบียนสารเคมีต้องเลือก export เป็น PDF ได้')
assert.ok(hubSource.includes('สารเคมีนำเข้าใหม่'), 'ทะเบียนสารเคมีต้องมี checkbox ทำเครื่องหมายสารเคมีนำเข้าใหม่')
assert.ok(hubSource.includes('newChemicalHoldingIds'), 'ทะเบียนสารเคมีต้องส่งรายการที่ทำเครื่องหมายไปยัง export')
assert.ok(hubSource.includes('...(selectedRoomId ? { roomId: selectedRoomId } : {})'), 'export ต้องส่งตัวกรองห้องสารเคมีไปยัง API')

const registryModalSource = readFileSync(join(COMPONENT_DIR, 'RegistryChangeModal.tsx'), 'utf8')
assert.ok(registryModalSource.includes('{!isHolding && ('), 'ฟอร์มแก้ไขสารต้องแสดงส่วน GHS')
assert.ok(registryModalSource.includes('ghsPictogramCodes: pictograms'), 'ฟอร์มแก้ไขสารต้องส่งสัญลักษณ์ GHS ผ่าน workflow')
assert.ok(registryModalSource.includes('ghsHazardClasses: hazards'), 'ฟอร์มแก้ไขสารต้องส่งหมวดความเป็นอันตรายผ่าน workflow')
assert.ok(registryModalSource.includes('GHS เบื้องต้นสำหรับทะเบียน'), 'ฟอร์มทะเบียนต้องระบุว่า GHS เป็นข้อมูลเบื้องต้น')
assert.ok(registryModalSource.includes('<option value="active">Active</option>'), 'ฟอร์มทะเบียนต้องเลือกสถานะ Active ได้')
assert.ok(registryModalSource.includes('<option value="retired">Inactive</option>'), 'ฟอร์มทะเบียนต้องเลือกสถานะ Inactive ได้')

const sdsSource = readFileSync(join(COMPONENT_DIR, 'SdsManagementClient.tsx'), 'utf8')
assert.ok(sdsSource.includes('เพิ่ม SDS'), 'SDS แยกตามงานต้องมีปุ่มเพิ่มเอกสารใหม่')
assert.ok(sdsSource.includes('แก้ไขชื่อ'), 'SDS แยกตามงานต้องมีปุ่มแก้ไขชื่อเอกสาร')
for (const required of ['@/components/ui/Card', '@/components/ui/Button', '@/components/ui/Stat']) {
  assert.ok(sdsSource.includes(required), `SdsManagementClient ต้อง import ${required}`)
}
assert.ok(hubSource.includes('SdsManagementClient'), 'แท็บ SDS ต้องแสดงภายในหน้าสารเคมีและ SDS')
assert.ok(hubSource.includes("view === 'sds-chemicals'"), 'แท็บ SDS ห้องสารเคมีต้องอยู่ในหน้าสารเคมีและ SDS')
assert.ok(hubSource.includes("view === 'sds-departments'"), 'แท็บ SDS แยกตามงานต้องอยู่ในหน้าสารเคมีและ SDS')

// ── แหล่งเดียวของการแมปความหมาย → ภาพ ──────────────────────────────────────
// ห้ามประกาศแผนที่สีของโซนซ้ำในไฟล์ client (เคยมี GROUP_COLORS ซ้ำใน hub)
for (const file of files) {
  if (file.endsWith(join('shared', 'tokens.ts'))) continue
  const source = readFileSync(file, 'utf8')
  assert.ok(
    !/GROUP_COLORS\s*[:=]/.test(source),
    `${file.replace(process.cwd(), '')} ประกาศแผนที่สีโซนซ้ำ — ให้ใช้ ZONE_META จาก shared/tokens.ts`,
  )
}

// ── modal ต้องปิดด้วยปุ่ม X เท่านั้น ตามข้อตกลงของโปรเจค ────────────────────
const modalSource = readFileSync(join(COMPONENT_DIR, 'SdsEditorModal.tsx'), 'utf8')
assert.ok(modalSource.includes('role="dialog"'), 'SdsEditorModal ต้องประกาศ role="dialog"')
assert.ok(modalSource.includes('aria-modal="true"'), 'SdsEditorModal ต้องประกาศ aria-modal')
assert.ok(modalSource.includes('GHS ที่ยืนยันจาก SDS หมวด 2'), 'ฟอร์ม SDS ต้องระบุว่า GHS มาจาก SDS หมวด 2')
assert.ok(modalSource.includes('sds-current-file-action'), 'ลิงก์เปิดไฟล์ปัจจุบันต้องแสดงเป็น action ที่เด่นชัด')
assert.ok(modalSource.includes('aria-label={`เปิดไฟล์ปัจจุบันของ ${productName}`}'), 'ปุ่มเปิดไฟล์ปัจจุบันต้องมีชื่อสำหรับ screen reader')
assert.ok(
  !/inset:\s*0[^}]*}\s*}\s*onClick/.test(modalSource),
  'SdsEditorModal ต้องไม่ปิดเมื่อคลิกพื้นหลัง (ข้อตกลงของโปรเจค: ปิดด้วยปุ่ม X เท่านั้น)',
)

// ── ช่องอัปโหลดต้องรองรับลากวางและคีย์บอร์ด ────────────────────────────────
const dropzoneSource = readFileSync(join(COMPONENT_DIR, 'shared', 'SdsDropzone.tsx'), 'utf8')
assert.ok(dropzoneSource.includes('onDrop'), 'ช่องอัปโหลด SDS ต้องรองรับการลากวาง')
assert.ok(dropzoneSource.includes('var(--primary-soft)'), 'drop zone ต้องเปลี่ยนพื้นเป็น --primary-soft ตอนลากผ่าน')
assert.ok(dropzoneSource.includes('<button'), 'drop zone ต้องเป็น <button> เพื่อให้ใช้คีย์บอร์ดได้')

// ── หน้าสาธารณะต้องไม่ติด guard ────────────────────────────────────────────
// เคยเรียก requireChemicalAdmin ทั้งหน้าและ API ทำให้ผู้ที่ไม่ล็อกอินได้ 404/401
const publicPage = readFileSync(join(process.cwd(), 'app', '(public)', 'sds', 'page.tsx'), 'utf8')
assert.ok(!publicPage.includes('requireChemical'), 'หน้า /sds ต้องเปิดสาธารณะ ห้ามเรียก guard ของโมดูล')
for (const route of [
  join('app', 'api', 'public', 'sds', 'route.ts'),
  join('app', 'api', 'public', 'sds', '[publicId]', 'file', 'route.ts'),
  join('app', 'api', 'public', 'department-sds', 'route.ts'),
  join('app', 'api', 'public', 'department-sds', '[publicId]', 'file', 'route.ts'),
]) {
  const source = readFileSync(join(process.cwd(), route), 'utf8')
  assert.ok(!source.includes('requireChemical'), `${route} ต้องเปิดสาธารณะ ห้ามเรียก guard ของโมดูล`)
  assert.ok(source.includes('consumeClientRateLimit'), `${route} ต้องมี rate limit`)
}

console.log('chemical-safety ui: ok')
