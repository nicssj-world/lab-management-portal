import assert from 'node:assert/strict'
import {
  CHEMICAL_SDS_DEPARTMENTS,
  archiveFolderOf,
  cleanSdsDisplayName,
  departmentByCode,
  departmentByName,
  departmentForArchiveFolder,
  fileNameOf,
} from './departments'
import { DEPARTMENTS } from '@/lib/validations/user-schema'

// ── ตารางแมปงาน ─────────────────────────────────────────────────────────────
assert.equal(CHEMICAL_SDS_DEPARTMENTS.length, 10)

// ทุกงานต้องอ้าง DEPARTMENTS จริง ไม่งั้นตรวจสิทธิ์หัวหน้างานด้วย profiles.dept จะไม่มีวันตรงกัน
for (const entry of CHEMICAL_SDS_DEPARTMENTS) {
  assert.ok(DEPARTMENTS.includes(entry.department), `${entry.department} is not in DEPARTMENTS`)
  assert.match(entry.code, /^[a-z][a-z0-9-]*$/)
}

// code / department / archiveFolder ต้องไม่ซ้ำกันเอง
for (const key of ['code', 'department', 'archiveFolder'] as const) {
  const values = CHEMICAL_SDS_DEPARTMENTS.map(entry => entry[key])
  assert.equal(new Set(values).size, values.length, `duplicate ${key}`)
}

// สามงานที่ชื่อโฟลเดอร์ไม่ตรงกับ DEPARTMENTS — จุดที่พลาดง่ายที่สุด
assert.equal(departmentForArchiveFolder('งานจุลทรรศนศาสตร์')?.department, 'งานจุลทรรศนศาสตร์คลินิก')
assert.equal(departmentForArchiveFolder('งานภูมิคุ้มกันวิทยา')?.department, 'งานภูมิคุ้มกันวิทยาคลินิก')
assert.equal(
  departmentForArchiveFolder('ศูนย์สุขภาพชุมชนเมืองชลบุรี')?.department,
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
)

// งานที่ชื่อตรงกันอยู่แล้ว
assert.equal(departmentForArchiveFolder('งานคลังเลือด')?.code, 'blood-bank')
assert.equal(departmentForArchiveFolder('งานเคมีคลินิก')?.code, 'chemistry')
assert.equal(departmentForArchiveFolder('งานจุลชีววิทยา')?.code, 'microbiology')
assert.equal(departmentForArchiveFolder('งานอณูชีววิทยา')?.code, 'biomolecular')
assert.equal(departmentForArchiveFolder('งานโลหิตวิทยาคลินิก')?.code, 'hematology')
assert.equal(departmentForArchiveFolder('งานบริการผู้ป่วยนอก')?.code, 'outpatient')
assert.equal(departmentForArchiveFolder('งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ')?.code, 'special-test')

// fail-closed: ห้องสารเคมีไปทาง chemical_products ไม่ใช่คลังเอกสารงาน
assert.equal(departmentForArchiveFolder('ห้องสารเคมี'), null)
assert.equal(departmentForArchiveFolder('งานที่ยังไม่มีในระบบ'), null)
assert.equal(departmentForArchiveFolder(''), null)

assert.equal(departmentByCode('blood-bank')?.archiveFolder, 'งานคลังเลือด')
assert.equal(departmentByCode('ไม่มีจริง'), null)
assert.equal(departmentByName('งานภูมิคุ้มกันวิทยาคลินิก')?.code, 'immunology')
assert.equal(departmentByName('ห้องสารเคมี'), null)

// ── การอ่าน path จาก chemical_sds_files.source_paths ─────────────────────────
assert.equal(archiveFolderOf('งานคลังเลือด/14.SDS EDTA.pdf'), 'งานคลังเลือด')
assert.equal(archiveFolderOf('งานคลังเลือด\\14.SDS EDTA.pdf'), 'งานคลังเลือด')
assert.equal(archiveFolderOf('ไฟล์ที่ไม่มีโฟลเดอร์.pdf'), '')
assert.equal(fileNameOf('งานคลังเลือด/14.SDS EDTA.pdf'), '14.SDS EDTA.pdf')
assert.equal(fileNameOf('no-folder.pdf'), 'no-folder.pdf')

// ── การล้างชื่อไฟล์ (เคสจากไฟล์จริงทั้งหมด) ─────────────────────────────────
assert.equal(cleanSdsDisplayName('1.GLUC3_08057800190_25.08.2020.pdf'), 'GLUC3')
assert.equal(cleanSdsDisplayName('10.PHOS2_08058610190_25.08.2020.pdf'), 'PHOS2')
assert.equal(cleanSdsDisplayName('11.SDS SODIUM AZIDE.PDF'), 'SODIUM AZIDE')
assert.equal(cleanSdsDisplayName('14.SDS EDTA.pdf'), 'EDTA')
assert.equal(cleanSdsDisplayName('1.SDS ABO Rh Reverse.pdf'), 'ABO Rh Reverse')
assert.equal(cleanSdsDisplayName('10.Simultest Ctrl safetyDataSheet_340041.pdf'), 'Simultest Ctrl')
assert.equal(cleanSdsDisplayName('1.CD4 safetyDataSheet_340383.pdf'), 'CD4')
assert.equal(cleanSdsDisplayName('100.TSH Calibrators_098167.pdf'), 'TSH Calibrators')
assert.equal(cleanSdsDisplayName('1 - MSDS - LabStripU11Plus LABUMAT (Thai).pdf'), 'LabStripU11Plus LABUMAT (Thai)')
assert.equal(cleanSdsDisplayName('12 MSDS - Methamphetamine (Thai).pdf'), 'Methamphetamine (Thai)')
assert.equal(cleanSdsDisplayName('246004_SDS_US_EN_PHOENIX AST INDICATOR.pdf'), 'PHOENIX AST INDICATOR')
assert.equal(cleanSdsDisplayName('1.MSDA_VACUETTE 9NC Sodium Citrate 3.2_.pdf'), 'VACUETTE 9NC Sodium Citrate 3.2')
assert.equal(cleanSdsDisplayName('1 SDS AFP ภาษาไทย.pdf'), 'AFP ภาษาไทย')
assert.equal(cleanSdsDisplayName('10 Alinity Trigger Solution.pdf'), 'Alinity Trigger Solution')
assert.equal(cleanSdsDisplayName('1.MSDS_DS diluent_Thai version.docx'), 'DS diluent Thai version')
assert.equal(cleanSdsDisplayName('16.CACl2.doc'), 'CACl2')
assert.equal(cleanSdsDisplayName('7-9.Ammonia.pdf'), 'Ammonia')

// รับ path เต็มได้เหมือนรับชื่อไฟล์
assert.equal(cleanSdsDisplayName('งานคลังเลือด/14.SDS EDTA.pdf'), 'EDTA')

// ห้ามคืนชื่อว่างไม่ว่ากรณีใด
assert.equal(cleanSdsDisplayName('SDS.pdf'), 'SDS')
assert.equal(cleanSdsDisplayName('12345678.pdf'), '12345678')
assert.equal(cleanSdsDisplayName('.pdf'), '.pdf')
for (const sample of ['1.SDS.pdf', 'MSDS.pdf', '99 - MSDS - .pdf']) {
  assert.notEqual(cleanSdsDisplayName(sample).trim(), '', `empty name for ${sample}`)
}

console.log('chemical-safety departments: ok')
