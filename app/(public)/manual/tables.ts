export type ColumnKind = 'text' | 'lines' | 'color' | 'select'

export interface TableColumn {
  key: string
  label: string
  kind: ColumnKind
  /** omitted = shown on both language tabs; else only that tab */
  lang?: 'th' | 'en'
  /** for kind: 'select' — the allowed values */
  options?: { value: string; label: string }[]
}

export interface TableSchema {
  id: string
  sectionId: string
  title: string
  columns: TableColumn[]
}

/** A row as handled by the editor: text cells are string, 'lines' cells are string[]. */
export type EditableRow = Record<string, string | string[]>

export const TABLE_SCHEMAS: Record<string, TableSchema> = {
  retention: {
    id: 'retention',
    sectionId: 'addon',
    title: 'ระยะเวลาเก็บสิ่งตัวอย่างหลังการตรวจวิเคราะห์',
    columns: [
      { key: 'emoji', label: 'ไอคอน', kind: 'text' },
      { key: 'sectionTh', label: 'งาน (ไทย)', kind: 'text', lang: 'th' },
      { key: 'sectionEn', label: 'Section (EN)', kind: 'text', lang: 'en' },
      { key: 'durationTh', label: 'ระยะเวลาเก็บ (แต่ละบรรทัด)', kind: 'lines' },
    ],
  },
  addonLimits: {
    id: 'addonLimits',
    sectionId: 'addon',
    title: 'ระยะเวลาของการเพิ่มรายการทดสอบโดยใช้ตัวอย่างเดิม',
    columns: [
      { key: 'emoji', label: 'ไอคอน', kind: 'text' },
      { key: 'sectionTh', label: 'งาน (ไทย)', kind: 'text', lang: 'th' },
      { key: 'sectionEn', label: 'Section (EN)', kind: 'text', lang: 'en' },
      { key: 'examplesTh', label: 'ตัวอย่าง (ไทย)', kind: 'text', lang: 'th' },
      { key: 'examplesEn', label: 'Examples (EN)', kind: 'text', lang: 'en' },
      { key: 'limitTh', label: 'ระยะเวลา (ไทย)', kind: 'text', lang: 'th' },
      { key: 'limitEn', label: 'Time limit (EN)', kind: 'text', lang: 'en' },
    ],
  },
  phoneDirectory: {
    id: 'phoneDirectory',
    sectionId: 'home',
    title: 'เบอร์โทรภายใน',
    columns: [
      { key: 'label', label: 'ชื่อ', kind: 'text' },
      { key: 'ext', label: 'เบอร์', kind: 'text' },
    ],
  },
  team: {
    id: 'team',
    sectionId: 'home',
    title: 'รายชื่อทีม',
    columns: [
      { key: 'name', label: 'ชื่อ', kind: 'text' },
      { key: 'role', label: 'ตำแหน่ง / งาน', kind: 'text' },
      { key: 'ext', label: 'เบอร์', kind: 'text' },
    ],
  },
  containers: {
    id: 'containers',
    sectionId: 'collection',
    title: 'ภาชนะเก็บสิ่งส่งตรวจ',
    columns: [
      { key: 'color', label: 'สีจุด', kind: 'color' },
      { key: 'cap', label: 'ภาชนะ / ฝา', kind: 'text' },
      { key: 'use', label: 'การใช้งาน', kind: 'text' },
      { key: 'req', label: 'เบิกที่', kind: 'text' },
    ],
  },
  criticalValues: {
    id: 'criticalValues',
    sectionId: 'report',
    title: 'ค่าวิกฤติ (Critical Values)',
    columns: [
      { key: 'test', label: 'การตรวจ', kind: 'text' },
      { key: 'adult', label: 'ผู้ใหญ่', kind: 'text' },
      { key: 'child', label: 'เด็ก', kind: 'text' },
      { key: 'unit', label: 'หน่วย', kind: 'text' },
    ],
  },
  outlabPartners: {
    id: 'outlabPartners',
    sectionId: 'outlab',
    title: 'หน่วยงาน OUT LAB',
    columns: [
      { key: 'sector', label: 'ภาค', kind: 'select', options: [
        { value: 'gov', label: 'ภาครัฐ' },
        { value: 'priv', label: 'เอกชน' },
      ] },
      { key: 'name', label: 'ชื่อหน่วยงาน', kind: 'text' },
      { key: 'brand', label: 'ชื่อย่อ / แบรนด์', kind: 'text' },
      { key: 'accred', label: 'การรับรอง', kind: 'text' },
    ],
  },
}
