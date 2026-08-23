// กันไม่ให้ UI ของโมดูลสารเคมีหลุดกลับไปเป็นสไตล์เดิม
//
// ก่อนหน้านี้ทั้งโมดูลไม่ใช้ components/ui/ เลยสักตัว และฝังรหัสสีตรง ๆ จำนวนมาก
// ผลคือ dark mode พังทั้งโมดูล เพราะสีที่ฝังไว้ไม่เปลี่ยนตามธีม

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
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
assert.ok(hubSource.includes('summarizeChemicalRegistry(registry)'), 'registry UI must calculate distinct chemical masters separately from scoped entries')
assert.ok(hubSource.includes('สารเคมีหลัก'), 'registry UI must name the shared chemical identity explicitly')
assert.ok(hubSource.includes('รายการของงาน/คลัง'), 'registry UI must name the scoped work/storage entry explicitly')
assert.ok(hubSource.includes('สารเคมีหลักหนึ่งรายการอาจมีหลายรายการของงาน/คลัง'), 'registry UI must explain why one chemical can appear in multiple work/storage entries')
assert.ok(hubSource.includes('เพิ่มสารเคมีใหม่'), 'registry add button must keep the existing direct wording')
assert.ok(!hubSource.includes('chemical-position-select'), 'storage position filter must be removed from the registry')
assert.ok(!hubSource.includes('กรองตามตำแหน่งจัดเก็บ'), 'storage position filter label must be removed from the registry')
for (const required of ['@/components/ui/Card', '@/components/ui/PageHeader', '@/components/ui/ViewTabs', '@/components/ui/EmptyState']) {
  assert.ok(hubSource.includes(required), `ChemicalSafetyHubClient ต้อง import ${required}`)
}
// เพิ่ม/แก้ไข/เลิกใช้งานสารเคมียังต้องผ่านฟอร์มเดียวกัน แต่มีผลทันที ไม่มีคิวรอทบทวนแล้ว
assert.ok(hubSource.includes('RegistryChangeModal'), 'ทะเบียนสารเคมีต้องมีฟอร์มเพิ่ม/แก้ไขผ่าน RegistryChangeModal')
assert.ok(hubSource.includes('ChemicalDetailsModal'), 'ทะเบียนสารเคมีต้องมีจุดเข้าใช้งานรายละเอียดสารเพียงจุดเดียว')
assert.ok(hubSource.includes('รายละเอียดสาร'), 'ปุ่มรวมต้องใช้คำว่า รายละเอียดสาร ที่ผู้ใช้เข้าใจได้')
assert.ok(!hubSource.includes('ChangeRequestPanel'), 'ยกเลิกระบบรออนุมัติแล้ว ต้องไม่มีแผงรอทบทวนคำขอเหลืออยู่')
// แท็บต้องผูกกับ URL ไม่ใช่ useState ไม่งั้นแชร์ลิงก์และกดย้อนกลับไม่ได้
assert.ok(hubSource.includes('ViewTabs'), 'แท็บของหน้าห้องสารเคมีต้องใช้ ViewTabs ที่ผูกกับ ?view=')
// กดรายละเอียดจากทะเบียนต้องเข้าหน้าต่างเดียว แล้วสลับแท็บข้อมูลทะเบียน/SDS ได้
assert.ok(!hubSource.includes('RegistrySdsWorkflowModal'), 'ยกเลิกระบบรออนุมัติแล้ว ต้องไม่เหลือหน้าต่าง workflow SDS')
assert.ok(!hubSource.includes('title="แก้ไขข้อมูลสารในทะเบียน"'), 'ตารางไม่ควรแยกปุ่มข้อมูลทะเบียนออกจากรายละเอียดสาร')
assert.ok(!hubSource.includes('title="แก้ไขเอกสาร SDS / แนบไฟล์ PDF"'), 'ตารางไม่ควรแยกปุ่ม SDS ออกจากรายละเอียดสาร')
// เจาะจงที่ป้ายปุ่ม/ข้อความที่ผู้ใช้เห็นจริง ไม่ใช่คำว่า "ส่งทบทวน" ลอย ๆ
// เพราะคอมเมนต์ที่อธิบายว่าขั้นตอนนี้ถูกยกเลิกไปแล้วก็มีคำนั้นอยู่
for (const gone of ['บันทึกและส่งทบทวน', 'ผู้ทบทวนอนุมัติ', 'summarizeSdsWorkflow', 'ศูนย์กลาง workflow SDS']) {
  assert.ok(!hubSource.includes(gone), `ทะเบียนสารเคมีต้องไม่เหลือร่องรอยขั้นตอนอนุมัติ: ${gone}`)
}
assert.ok(hubSource.includes('roomRegistry'), 'แท็บ SDS ห้องสารเคมีต้องได้รับรายการสารจากทะเบียนโดยตรง')
assert.ok(hubSource.includes('สถานะการใช้งาน'), 'ทะเบียนสารเคมีต้องมีตัวกรอง/คอลัมน์สถานะการใช้งาน')
assert.ok(hubSource.includes('Active') && hubSource.includes('Inactive'), 'ทะเบียนสารเคมีต้องแสดงสถานะ Active/Inactive')
assert.ok(hubSource.includes("icon={isInactive ? 'eye' : 'eyeOff'}"), 'ปุ่มเปลี่ยนสถานะต้องใช้ไอคอนเปิด/ปิดการมองเห็น ไม่ใช่ไอคอนถังขยะ')
assert.ok(hubSource.includes('ตั้งสถานะเป็น Inactive'), 'ปุ่ม Active ต้องบอกผลลัพธ์ว่าจะตั้งเป็น Inactive')
assert.ok(hubSource.includes('ตั้งสถานะเป็น Active'), 'ปุ่ม Inactive ต้องบอกผลลัพธ์ว่าจะตั้งเป็น Active')
assert.ok(!hubSource.includes("icon={isInactive ? 'check' : 'trash'}"), 'ปุ่มเปลี่ยนสถานะต้องไม่ใช้ไอคอนถังขยะ')
assert.ok(!hubSource.includes('ตามหน่วยงาน · ไม่ระบุตำแหน่ง'), 'ทะเบียนไม่ควรแสดงป้ายตามหน่วยงานที่ทำให้ข้อมูลในแถวรก')
assert.ok(hubSource.includes('chemical-registry-actions'), 'action bar ของทะเบียนต้องมี hook สำหรับจัด layout แบบ responsive')
assert.ok(hubSource.includes('chemical-registry-action-label-long'), 'action bar ต้องมีป้ายกำกับเต็มบนจอใหญ่')
assert.ok(hubSource.includes('chemical-registry-action-label-short'), 'action bar ต้องมีป้ายกำกับย่อบนจอเล็ก')
assert.ok(hubSource.includes('@media(max-width:1200px)'), 'action bar ต้องย่อป้ายกำกับเมื่อพื้นที่หน้าจอจำกัด')
assert.ok(hubSource.includes('>รายละเอียด</span>'), 'ป้ายย่อของรายละเอียดสารต้องยังสื่อความหมายได้')
assert.ok(hubSource.includes("'พักใช้งาน'") && hubSource.includes("'เปิดใช้งาน'"), 'ป้ายย่อของการเปลี่ยนสถานะต้องสื่อผลลัพธ์ของ action')
assert.ok(hubSource.includes('row.reportedTotalRaw'), 'ทะเบียนสารเคมีต้องแสดงปริมาณดิบเมื่อหน่วยจากแบบสำรวจไม่ใช่หน่วยมาตรฐาน')
assert.ok(hubSource.includes('Export Excel'), 'ทะเบียนสารเคมีต้องเลือก export เป็น Excel ได้')
assert.ok(hubSource.includes('Export PDF'), 'ทะเบียนสารเคมีต้องเลือก export เป็น PDF ได้')
assert.ok(hubSource.includes('สารเคมีนำเข้าใหม่'), 'ทะเบียนสารเคมีต้องมี checkbox ทำเครื่องหมายสารเคมีนำเข้าใหม่')
assert.ok(hubSource.includes('newChemicalHoldingIds'), 'ทะเบียนสารเคมีต้องส่งรายการที่ทำเครื่องหมายไปยัง export')
assert.ok(hubSource.includes('...(selectedRoomId ? { roomId: selectedRoomId } : {})'), 'export ต้องส่งตัวกรองห้องสารเคมีไปยัง API')
assert.ok(hubSource.includes('RegistryHorizontalScroll'), 'ตารางทะเบียนต้องมี scrollbar แนวนอนที่เข้าถึงได้โดยไม่ต้องเลื่อนไปท้ายตาราง')
assert.ok(hubSource.includes('chemical-registry-floating-scroll'), 'ตารางทะเบียนต้องแสดง scrollbar แนวนอนแบบลอยระหว่างที่ท้ายตารางยังอยู่นอกจอ')
assert.ok(hubSource.includes('registryTableScrollRef'), 'scrollbar แบบลอยต้อง sync ตำแหน่งกับตารางทะเบียน')

const registryModalSource = readFileSync(join(COMPONENT_DIR, 'RegistryChangeModal.tsx'), 'utf8')
assert.ok(registryModalSource.includes('เพิ่มสารเคมีใหม่'), 'create modal must keep the existing direct title')
assert.ok(registryModalSource.includes('สร้างรายการสารใหม่'), 'new-entry mode must keep the existing direct wording')
assert.ok(registryModalSource.includes('ใช้สารที่มีอยู่'), 'existing-entry mode must keep the existing direct wording')
assert.ok(registryModalSource.includes('ใช้ข้อมูลสารเดิมได้เมื่อเป็นสารชนิดเดียวกันจริง โดยตรวจจากผู้ผลิต รหัสผลิตภัณฑ์ และความเข้มข้น'), 'existing-product guidance must keep the existing direct wording')
assert.ok(registryModalSource.includes("productMode === 'new'"), 'ฟอร์มสร้าง product ใหม่ต้องแสดงส่วนข้อมูลสารและ GHS')
assert.ok(registryModalSource.includes('SdsDropzone'), 'ฟอร์มเพิ่มสารใหม่ต้องมีช่องแนบ SDS ใน flow เดียวกัน')
assert.ok(registryModalSource.includes('แนบไฟล์ SDS (ถ้ามีแล้ว)'), 'ฟอร์มเพิ่มสารใหม่ต้องบอกว่าแนบ SDS ได้ทันทีแต่ไม่บังคับ')
assert.ok(registryModalSource.includes("if (next === 'existing') setSdsFile(null)"), 'เปลี่ยนไปใช้สารเดิมต้องล้างไฟล์ SDS ที่เลือกไว้เพื่อไม่ให้ผู้ใช้เข้าใจว่าจะถูกแนบกับสารเดิม')
assert.ok(registryModalSource.includes('/api/admin/chemical-safety/sds'), 'ฟอร์มเพิ่มสารใหม่ต้องสร้าง SDS ต่อจาก holding ที่เพิ่งสร้าง')
assert.ok(registryModalSource.includes('createdHoldingId'), 'ฟอร์มเพิ่มสารใหม่ต้องรองรับ retry การอัปโหลดโดยไม่สร้างทะเบียนซ้ำ')
assert.ok(registryModalSource.includes('ghsPictogramCodes: pictograms'), 'ฟอร์มแก้ไขสารต้องส่งสัญลักษณ์ GHS ผ่าน workflow')
assert.ok(registryModalSource.includes('ghsHazardClasses: hazards'), 'ฟอร์มแก้ไขสารต้องส่งหมวดความเป็นอันตรายผ่าน workflow')
assert.ok(registryModalSource.includes('ข้อมูลสารในทะเบียน'), 'ฟอร์มแก้ไข product ต้องระบุว่าเป็นข้อมูลในทะเบียน')
assert.ok(registryModalSource.includes('ผู้ผลิตในทะเบียน'), 'ฟอร์มทะเบียนต้องแยกผู้ผลิตออกจากผู้ผลิตตาม SDS')
assert.ok(registryModalSource.includes('แท็บ “เอกสาร SDS”'), 'ฟอร์มทะเบียนต้องบอกจุดแก้ไขเอกสาร SDS อย่างชัดเจน')
assert.ok(registryModalSource.includes('GHS เบื้องต้นสำหรับทะเบียน'), 'ฟอร์มทะเบียนต้องระบุว่า GHS เป็นข้อมูลเบื้องต้น')
assert.ok(registryModalSource.includes('<option value="active">Active</option>'), 'ฟอร์มทะเบียนต้องเลือกสถานะ Active ได้')
assert.ok(registryModalSource.includes('<option value="retired">Inactive</option>'), 'ฟอร์มทะเบียนต้องเลือกสถานะ Inactive ได้')

const detailsModalPath = join(COMPONENT_DIR, 'ChemicalDetailsModal.tsx')
assert.ok(existsSync(detailsModalPath), 'รายละเอียดสารต้องมีคอมโพเนนต์ modal กลาง')
const detailsModalSource = existsSync(detailsModalPath) ? readFileSync(detailsModalPath, 'utf8') : ''
assert.ok(detailsModalSource.includes('ข้อมูลสารเคมีหลัก'), 'details modal must name the shared chemical identity section')
assert.ok(detailsModalSource.includes('รายการคลังของงาน/ห้องนี้'), 'details modal must name the scoped inventory entry')
assert.ok(detailsModalSource.includes('ข้อมูลทะเบียน'), 'รายละเอียดสารต้องมีแท็บข้อมูลทะเบียน')
assert.ok(detailsModalSource.includes('เอกสาร SDS'), 'รายละเอียดสารต้องมีแท็บเอกสาร SDS')
assert.ok(detailsModalSource.includes('role="tab"'), 'แท็บรายละเอียดสารต้องใช้ semantics ของ tab')
assert.ok(detailsModalSource.includes('aria-selected'), 'แท็บรายละเอียดสารต้องประกาศแท็บที่เลือกสำหรับ screen reader')
assert.ok(detailsModalSource.includes('embedded'), 'ฟอร์มเดิมต้องฝังอยู่ใน modal เดียวได้โดยไม่ซ้อน overlay')
assert.ok(detailsModalSource.includes('icon="upload"'), 'รายละเอียดสารต้องมีทางไปแนบไฟล์ SDS')

const submitChangeRequestSource = readFileSync(join(process.cwd(), 'app', 'api', 'admin', 'chemical-safety', 'change-requests', '[id]', 'submit', 'route.ts'), 'utf8')
assert.ok(submitChangeRequestSource.includes('holdingId'), 'submit registry entry ต้องส่ง holdingId กลับเพื่อแนบ SDS ต่อใน flow เดียวกัน')
assert.ok(submitChangeRequestSource.includes("entity_type === 'registry_entry'"), 'submit route ต้องคืนผลลัพธ์เฉพาะ workflow ทะเบียนสาร')

const sdsSource = readFileSync(join(COMPONENT_DIR, 'SdsManagementClient.tsx'), 'utf8')
const tokenSource = readFileSync(join(COMPONENT_DIR, 'shared', 'tokens.ts'), 'utf8')
const chemicalApiSource = readFileSync(join(process.cwd(), 'lib', 'chemical-safety', 'api.ts'), 'utf8')
const publicSdsLibrarySource = readFileSync(join(COMPONENT_DIR, 'PublicSdsLibrary.tsx'), 'utf8')
const publicDepartmentSdsSource = readFileSync(join(COMPONENT_DIR, 'PublicDepartmentSds.tsx'), 'utf8')
const safetyManualActionsSource = readFileSync(join(COMPONENT_DIR, 'SafetyManualActions.tsx'), 'utf8')
const sdsPdfViewerPath = join(COMPONENT_DIR, 'SdsPdfViewerModal.tsx')
assert.ok(existsSync(sdsPdfViewerPath), 'SDS PDF viewer modal must exist')
const sdsPdfViewerSource = existsSync(sdsPdfViewerPath) ? readFileSync(sdsPdfViewerPath, 'utf8') : ''
assert.ok(!sdsSource.includes('DepartmentSdsUploadModal'), 'SDS แยกตามงานต้องปิดการเพิ่มเอกสาร legacy ใหม่')
assert.doesNotMatch(sdsSource, /fetch\(/, 'SDS แยกตามงานต้องเป็น read-only')
assert.doesNotMatch(sdsSource, /แก้ไขชื่อ|แทนที่ไฟล์|ลบเอกสาร|เพิ่มเข้าทะเบียนสารเคมี/, 'SDS แยกตามงานต้องไม่มีปุ่ม mutation')
assert.doesNotMatch(sdsSource, /registryLink\.status === 'registered'/, 'SDS แยกตามงานต้องไม่ใช้ workflow เทียบชื่อแบบเดิม')
assert.ok(!sdsSource.includes('DepartmentSdsLinkModal'), 'SDS แยกตามงานต้องไม่เปิด modal ของ workflow เดิม')
assert.ok(sdsSource.includes('departmentRegistry'), 'SDS แยกตามงานต้องรับรายการทะเบียนจาก workflow ใหม่')
assert.ok(sdsSource.includes('แก้ไข SDS ได้จากทะเบียนสารเคมี'), 'แท็บ SDS แยกตามงานต้องบอกจุดที่ใช้แก้ไข SDS ให้ชัดเจน')
assert.ok(sdsSource.includes('รอเชื่อมกับทะเบียน'), 'เอกสารที่ยังไม่เชื่อมทะเบียนต้องใช้ข้อความที่ผู้ใช้เข้าใจได้')
assert.ok(sdsSource.includes('ค้นหารายการในงาน'), 'SDS แยกตามงานต้องค้นหารายการภายในงานที่เปิดดูได้')
assert.ok(sdsSource.includes('เอกสารเดิมที่ยังไม่เชื่อมกับทะเบียน'), 'เอกสารเดิมที่ไม่ซ้ำกับทะเบียนต้องแยกเป็นรายการรอดำเนินการให้เห็นชัดเจน')
assert.ok(sdsSource.includes('registryLink.holdingId'), 'รายการ SDS ที่แสดงในงานต้องผูกกลับไปยังรายการทะเบียนด้วย holdingId')
assert.ok(sdsSource.includes('open && registryRows.length > 0'), 'รายการทะเบียนต้องถูกซ่อนจนกว่าจะกดดูรายการของงาน')
assert.doesNotMatch(sdsSource, /\{registryRows\.map\(row => \(/, 'SDS แยกตามงานต้องไม่แสดงรายการทะเบียนซ้ำอยู่นอกส่วนที่เปิดดู')
assert.ok(sdsSource.includes('summarizeRoomSds'), 'SDS ห้องสารเคมีต้องสรุปจำนวนจากทะเบียนและจำนวนเวอร์ชันแยกกัน')
assert.ok(sdsSource.includes('มี SDS แล้ว'), 'SDS ห้องสารเคมีต้องแสดงจำนวนสารที่มี SDS แล้วอย่างชัดเจน')
assert.ok(sdsSource.includes('ยังไม่มี SDS'), 'SDS ห้องสารเคมีต้องแสดงสารในทะเบียนที่ยังไม่มี SDS')
assert.ok(sdsSource.includes('openHoldingId'), 'SDS ห้องสารเคมีต้องซ่อนรายละเอียดเวอร์ชันจนกว่าจะเลือกสาร')
assert.ok(sdsSource.includes('กรองสถานะ SDS'), 'SDS ห้องสารเคมีต้องกรองรายการตามสถานะ SDS ได้')
assert.ok(sdsSource.includes('ดูรายละเอียด'), 'SDS ห้องสารเคมีต้องมี progressive disclosure สำหรับรายละเอียดเวอร์ชัน')
assert.ok(sdsSource.includes('รายการจากทะเบียนห้องสารเคมี'), 'SDS ห้องสารเคมีต้องสื่อชัดว่ารายการหลักมาจากทะเบียน')
assert.ok(sdsSource.includes('currentSdsItemsForHolding'), 'SDS ห้องสารเคมีต้องแสดงเฉพาะเวอร์ชันที่ยังใช้งาน ไม่แสดงฉบับถูกแทนที่')
assert.ok(sdsSource.includes('ตัวเลขในหน้านี้'), 'SDS ห้องสารเคมีต้องใช้หัวข้ออธิบายจำนวนที่สื่อความหมายชัดเจน')
assert.doesNotMatch(sdsSource, /วิธีอ่านตัวเลข/, 'SDS ห้องสารเคมีไม่ควรใช้คำว่า วิธีอ่านตัวเลข')
assert.doesNotMatch(sdsSource, /ส่งทบทวน/, 'หน้า SDS ปลายทางต้องไม่เป็นจุดส่ง SDS เข้าทบทวน')
assert.doesNotMatch(sdsSource, /บันทึกผลไม่อนุมัติแล้ว/, 'หน้า SDS ปลายทางต้องไม่เป็นจุดตัดสินอนุมัติ SDS')
assert.ok(sdsSource.includes('เหตุผลที่ต้องแก้ไข'), 'ข้อความประกอบเอกสารที่ต้องแก้ไขต้องไม่ใช้คำว่าไม่อนุมัติ')
assert.ok(tokenSource.includes('มี SDS แล้ว · ยังไม่ระบุปริมาณ'), 'ป้าย SDS-only ต้องอธิบายสถานะด้วยภาษาที่ผู้ใช้เข้าใจได้')
assert.ok(sdsSource.includes('ยังไม่ได้ระบุเลขฉบับ'), 'รายการ SDS ที่ไม่มี Revision ต้องบอกให้ชัดว่ายังไม่ได้ระบุเลขฉบับ')
for (const confusing of [
  'SDS-only — ยังไม่ระบุปริมาณ',
  'ไฟล์ legacy ที่ยังไม่เข้าทะเบียน',
  'ทะเบียน: storageScope = department · ไม่มีตำแหน่งจัดเก็บ',
  'ไฟล์กลุ่มนี้ยังไม่มี holdingId',
  'read-only',
]) {
  assert.ok(!sdsSource.includes(confusing), `ไม่ควรแสดงศัพท์ระบบที่ทำให้สับสน: ${confusing}`)
}
assert.ok(!tokenSource.includes('SDS-only — ยังไม่ระบุปริมาณ'), 'ไม่ควรแสดงป้าย SDS-only แบบเดิม')
assert.ok(tokenSource.includes('ฉบับเก่า · มีฉบับใหม่แล้ว'), 'สถานะเอกสารเก่าต้องอธิบายว่ามีฉบับใหม่แล้ว')
assert.ok(tokenSource.includes("approved: { label: 'มี SDS แล้ว'"), 'สถานะ approved ภายในต้องแสดงเป็นมี SDS แล้ว ไม่ใช่การอนุมัติ')
assert.ok(tokenSource.includes("approved: { label: 'พร้อมใช้งาน'"), 'ป้ายสถานะเอกสารต้องใช้พร้อมใช้งาน ไม่ใช่อนุมัติแล้ว')
assert.doesNotMatch(tokenSource, /อนุมัติแล้ว|ไม่อนุมัติ/, 'ข้อความสถานะ SDS ต้องไม่อ้างถึงการอนุมัติที่ไม่มีใน workflow ปัจจุบัน')
assert.ok(chemicalApiSource.includes('พร้อมใช้งานและมีไฟล์ PDF'), 'ข้อความ error ของ SDS ต้องอธิบายว่าต้องใช้เอกสารพร้อมไฟล์')
assert.doesNotMatch(chemicalApiSource, /SDS ที่อนุมัติแล้ว/, 'ข้อความ error ของ SDS ต้องไม่อ้างถึงการอนุมัติ')

// route ของด่านอนุมัติต้องถูกลบจริง ไม่ใช่แค่ซ่อนปุ่ม
for (const gone of [
  'app/api/admin/chemical-safety/sds/[id]/submit/route.ts',
  'app/api/admin/chemical-safety/sds/[id]/review/route.ts',
  'app/api/admin/chemical-safety/change-requests/[id]/review/route.ts',
]) {
  assert.ok(!existsSync(gone), `ยกเลิกระบบรออนุมัติแล้ว ต้องไม่เหลือ route: ${gone}`)
}
const existingLinkRoute = readFileSync(join(process.cwd(), 'app', 'api', 'admin', 'chemical-safety', 'department-sds', '[code]', 'link-existing', 'route.ts'), 'utf8')
assert.match(existingLinkRoute, /department_sds_link_existing_closed/, 'old link-existing endpoint must be closed')
assert.match(existingLinkRoute, /status:\s*410/, 'old link-existing endpoint must return Gone')
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
assert.ok(sdsPdfViewerSource.includes('PdfViewer'), 'SDS PDF viewer modal must use the shared PDF viewer')
assert.ok(sdsPdfViewerSource.includes('forcePdfJs'), 'SDS PDF viewer modal must keep PDF fallback inside the page')
for (const [name, source] of [
  ['staff SDS management', sdsSource],
  ['public chemical SDS library', publicSdsLibrarySource],
  ['public department SDS library', publicDepartmentSdsSource],
  ['SDS editor', modalSource],
  ['safety manual on SDS page', safetyManualActionsSource],
] as const) {
  assert.ok(source.includes('SdsPdfViewerModal'), `${name} must use the in-page SDS PDF viewer`)
  assert.doesNotMatch(source, /window\.open\(|target="_blank"/, `${name} must not open PDF in a new tab`)
}
assert.ok(modalSource.includes("role={embedded ? undefined : 'dialog'}"), 'SdsEditorModal ต้องประกาศ role="dialog" เมื่อใช้เป็น modal เดี่ยว')
assert.ok(modalSource.includes("aria-modal={embedded ? undefined : 'true'}"), 'SdsEditorModal ต้องประกาศ aria-modal เมื่อใช้เป็น modal เดี่ยว')
assert.ok(modalSource.includes('เอกสาร SDS ฉบับนี้'), 'ฟอร์ม SDS ต้องระบุว่าข้อมูลผูกกับเอกสารฉบับนี้')
assert.ok(modalSource.includes('ผู้ผลิตตาม SDS'), 'ฟอร์ม SDS ต้องแยกผู้ผลิตตามเอกสารออกจากข้อมูลทะเบียน')
assert.ok(modalSource.includes('GHS ตาม SDS หมวด 2'), 'ฟอร์ม SDS ต้องใช้คำที่ชัดว่า GHS มาจาก SDS')
assert.ok(modalSource.includes('ยังไม่มีไฟล์ PDF · SDS ยังไม่พร้อมใช้งาน'), 'ฟอร์ม SDS ต้องบอกผลของการยังไม่แนบไฟล์')
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
