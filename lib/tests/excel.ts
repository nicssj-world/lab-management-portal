export type TestExcelField =
  | 'id'
  | 'code'
  | 'lis_code'
  | 'cgd'
  | 'loinc'
  | 'th'
  | 'en'
  | 'short_name'
  | 'category'
  | 'category_id'
  | 'department'
  | 'active'
  | 'popular'
  | 'price'
  | 'tat_minutes'
  | 'urgent_tat_minutes'
  | 'available_24hr'
  | 'service'
  | 'method'
  | 'instrument'
  | 'methodology_note'
  | 'tube'
  | 'tube_color'
  | 'volume'
  | 'stability'
  | 'transport_condition'
  | 'reject'
  | 'specimen_note'
  | 'ref'
  | 'ref_note'
  | 'description'
  | 'contact_name'
  | 'contact_phone'
  | 'contact_email'
  | 'contact_note'
  | 'contact_staff'

export interface TestExcelColumn {
  key: TestExcelField
  header: string
  width: number
}

// Keep this list as the single contract shared by the export, import and template.
// The ID columns are intentionally visible so an exported file can safely update
// the same catalog row when it is imported again.
export const TEST_EXCEL_COLUMNS = [
  { key: 'id', header: 'ID ระบบ (ห้ามแก้ไข)', width: 16 },
  { key: 'code', header: 'รหัสรายการตรวจ', width: 20 },
  { key: 'lis_code', header: 'รหัส LIS', width: 16 },
  { key: 'cgd', header: 'รหัสกรมบัญชีกลาง', width: 20 },
  { key: 'loinc', header: 'LOINC', width: 14 },
  { key: 'th', header: 'ชื่อรายการตรวจวิเคราะห์', width: 32 },
  { key: 'en', header: 'ชื่อเต็ม/ชื่ออื่นๆ', width: 30 },
  { key: 'short_name', header: 'ชื่อย่อ', width: 18 },
  { key: 'category', header: 'หมวดหมู่', width: 24 },
  { key: 'category_id', header: 'หมวดหมู่ ID (ห้ามแก้ไข)', width: 20 },
  { key: 'department', header: 'หน่วยงาน', width: 26 },
  { key: 'active', header: 'เปิดใช้งาน', width: 14 },
  { key: 'popular', header: 'รายการยอดนิยม', width: 16 },
  { key: 'price', header: 'ราคา (บาท)', width: 14 },
  { key: 'tat_minutes', header: 'TAT', width: 20 },
  { key: 'urgent_tat_minutes', header: 'TAT เร่งด่วน', width: 20 },
  { key: 'available_24hr', header: 'ตลอด 24 ชั่วโมง', width: 18 },
  { key: 'service', header: 'วันเวลาที่ตรวจ', width: 26 },
  { key: 'method', header: 'วิธีการตรวจ', width: 28 },
  { key: 'instrument', header: 'เครื่องมือ', width: 24 },
  { key: 'methodology_note', header: 'ข้อบ่งชี้/หมายเหตุวิธีการ', width: 30 },
  { key: 'tube', header: 'ชนิด Specimen', width: 28 },
  { key: 'tube_color', header: 'สีหลอด', width: 14 },
  { key: 'volume', header: 'ปริมาตร', width: 14 },
  { key: 'stability', header: 'การเก็บรักษาหลังตรวจ', width: 30 },
  { key: 'transport_condition', header: 'เงื่อนไขการนำส่ง', width: 30 },
  { key: 'reject', header: 'เงื่อนไขปฏิเสธ', width: 30 },
  { key: 'specimen_note', header: 'รายละเอียด Specimen', width: 32 },
  { key: 'ref', header: 'ค่าอ้างอิง', width: 32 },
  { key: 'ref_note', header: 'หมายเหตุค่าอ้างอิง', width: 30 },
  { key: 'description', header: 'คำอธิบาย', width: 32 },
  { key: 'contact_name', header: 'ชื่อหน่วยงานติดต่อ', width: 26 },
  { key: 'contact_phone', header: 'โทรศัพท์ติดต่อ', width: 20 },
  { key: 'contact_email', header: 'อีเมลติดต่อ', width: 28 },
  { key: 'contact_note', header: 'หมายเหตุติดต่อ', width: 30 },
  { key: 'contact_staff', header: 'ติดต่อเจ้าหน้าที่', width: 18 },
] as const satisfies readonly TestExcelColumn[]

export const TEST_EXCEL_HEADERS = TEST_EXCEL_COLUMNS.map(column => column.header)
