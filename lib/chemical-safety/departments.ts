// คลังเอกสาร SDS แยกตามงาน — คนละโลกกับทะเบียนสารเคมีของห้องสารเคมี
//
// ห้องสารเคมีมีสารเคมีบริสุทธิ์ 25 ตัวที่ผ่าน master list, มีตำแหน่งจัดเก็บ, ปริมาณคงคลัง และ GHS
// ส่วนโฟลเดอร์งานอื่นเป็น SDS ของน้ำยา/ชุดตรวจเชิงพาณิชย์ ซึ่งไม่ใช่รายการคลังสารเคมี
// จึงเก็บแยกตาราง ห้ามยัดเข้า chemical_products ไม่งั้นทะเบียน 25 ตัวจะจมอยู่ในไฟล์น้ำยาหลายร้อยไฟล์

import { DEPARTMENTS } from '@/lib/validations/user-schema'

export interface ChemicalSdsDepartmentDefinition {
  /** slug ที่ใช้ใน URL และเป็น primary key ของตาราง */
  code: string
  /** ค่าจาก DEPARTMENTS — ต้องตรงกับ profiles.dept เพื่อให้ตรวจสิทธิ์หัวหน้างานได้ */
  department: (typeof DEPARTMENTS)[number]
  /** ชื่อโฟลเดอร์ชั้นบนสุดในคลัง MSDS 2568 */
  archiveFolder: string
}

// การแมปเป็นแบบ fail-closed: โฟลเดอร์ที่ไม่มีในตารางนี้จะไม่ถูกนำเข้าเลย
// ชื่อโฟลเดอร์สามชุดล่างสุดไม่ตรงกับ DEPARTMENTS จึงต้องระบุด้วยมือ ห้ามเดาด้วยการเทียบข้อความบางส่วน
// "ห้องสารเคมี" ไม่อยู่ในนี้โดยตั้งใจ — จัดการผ่าน chemical_products
export const CHEMICAL_SDS_DEPARTMENTS: readonly ChemicalSdsDepartmentDefinition[] = Object.freeze([
  { code: 'chemistry', department: 'งานเคมีคลินิก', archiveFolder: 'งานเคมีคลินิก' },
  { code: 'hematology', department: 'งานโลหิตวิทยาคลินิก', archiveFolder: 'งานโลหิตวิทยาคลินิก' },
  { code: 'immunology', department: 'งานภูมิคุ้มกันวิทยาคลินิก', archiveFolder: 'งานภูมิคุ้มกันวิทยา' },
  { code: 'microscopy', department: 'งานจุลทรรศนศาสตร์คลินิก', archiveFolder: 'งานจุลทรรศนศาสตร์' },
  { code: 'biomolecular', department: 'งานอณูชีววิทยา', archiveFolder: 'งานอณูชีววิทยา' },
  { code: 'microbiology', department: 'งานจุลชีววิทยา', archiveFolder: 'งานจุลชีววิทยา' },
  { code: 'blood-bank', department: 'งานคลังเลือด', archiveFolder: 'งานคลังเลือด' },
  {
    code: 'special-test',
    department: 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
    archiveFolder: 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
  },
  { code: 'outpatient', department: 'งานบริการผู้ป่วยนอก', archiveFolder: 'งานบริการผู้ป่วยนอก' },
  {
    code: 'chonburi-pcu',
    department: 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
    archiveFolder: 'ศูนย์สุขภาพชุมชนเมืองชลบุรี',
  },
])

const BY_ARCHIVE_FOLDER = new Map(CHEMICAL_SDS_DEPARTMENTS.map(item => [item.archiveFolder, item]))
const BY_CODE = new Map(CHEMICAL_SDS_DEPARTMENTS.map(item => [item.code, item]))
const BY_DEPARTMENT = new Map(CHEMICAL_SDS_DEPARTMENTS.map(item => [item.department, item]))

/** โฟลเดอร์ "ห้องสารเคมี" คืน null โดยตั้งใจ — ไม่ใช่ข้อผิดพลาด */
export function departmentForArchiveFolder(folder: string): ChemicalSdsDepartmentDefinition | null {
  return BY_ARCHIVE_FOLDER.get(folder.trim()) ?? null
}

export function departmentByCode(code: string): ChemicalSdsDepartmentDefinition | null {
  return BY_CODE.get(code.trim()) ?? null
}

export function departmentByName(department: string): ChemicalSdsDepartmentDefinition | null {
  return BY_DEPARTMENT.get(department.trim() as (typeof DEPARTMENTS)[number]) ?? null
}

/** โฟลเดอร์ชั้นบนสุดของ path ที่ importer บันทึกไว้ใน chemical_sds_files.source_paths */
export function archiveFolderOf(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/')
  const separator = normalized.indexOf('/')
  return separator === -1 ? '' : normalized.slice(0, separator)
}

export function fileNameOf(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/')
  return normalized.slice(normalized.lastIndexOf('/') + 1)
}

// ชื่อไฟล์ในคลังมีสามแบบปนกัน: เลขลำดับนำหน้า, คำว่า SDS/MSDS แทรกกลาง, และรหัสสินค้า/วันที่ต่อท้าย
// ตัวอย่างจริง:
//   "1.GLUC3_08057800190_25.08.2020.pdf"                 → "GLUC3"
//   "11.SDS SODIUM AZIDE.PDF"                            → "SODIUM AZIDE"
//   "10.Simultest Ctrl safetyDataSheet_340041.pdf"        → "Simultest Ctrl"
//   "1 - MSDS - LabStripU11Plus LABUMAT (Thai).pdf"       → "LabStripU11Plus LABUMAT (Thai)"
//   "246004_SDS_US_EN_PHOENIX AST INDICATOR.pdf"          → "PHOENIX AST INDICATOR"
const EXTENSION = /\.(?:pdf|docx?|html?)$/i
const LEADING_INDEX = /^\d+(?:\s*[-–]\s*\d+)*\s*[.\-–_)]*\s*/
const SDS_TOKEN = /(?:^|[\s_\-–])(?:m?sds|msda|safety\s*data\s*sheet|safetydatasheet)(?:[\s_\-–]|$)/gi
// เฉพาะรหัสภาษา/ภูมิภาคตัวพิมพ์ใหญ่ที่คั่นด้วย _ เท่านั้น (เช่น "_SDS_US_EN_")
// ไม่ใส่ flag i เพื่อไม่ให้ไปตัดคำจริงที่บังเอิญสะกดเหมือนกัน
const LOCALE_TOKEN = /(?:^|[\s_])(?:US|EU|EN|TH|GB)(?=[\s_]|$)/g
const TRAILING_CATALOG = /[\s_\-–]+\d{6,}\s*$/
const TRAILING_DATE = /[\s_\-–]+\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\s*$/

/**
 * ล้างชื่อไฟล์ให้อ่านออกสำหรับหน้าสาธารณะ
 * ถ้าล้างแล้วไม่เหลืออะไร จะคืนชื่อไฟล์เดิม (ไม่รวมนามสกุล) เสมอ — ห้ามได้ชื่อว่าง
 */
export function cleanSdsDisplayName(fileNameOrPath: string): string {
  const fileName = fileNameOf(fileNameOrPath)
  const withoutExtension = fileName.replace(EXTENSION, '')

  let name = withoutExtension
  name = name.replace(LEADING_INDEX, '')
  name = name.replace(SDS_TOKEN, ' ')
  name = name.replace(TRAILING_DATE, '')
  name = name.replace(TRAILING_CATALOG, '')
  name = name.replace(LOCALE_TOKEN, ' ')
  name = name.replace(/[_]+/g, ' ')
  name = name.replace(/\s*[-–]\s*/g, ' - ')
  name = name.replace(/^[\s\-–.,_]+|[\s\-–.,_]+$/g, '')
  name = name.replace(/\s+/g, ' ').trim()

  if (name === '') return withoutExtension.trim() || fileName
  return name
}
