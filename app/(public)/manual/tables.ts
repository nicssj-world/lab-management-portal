export type ColumnKind = 'text' | 'lines'

export interface TableColumn {
  key: string
  label: string
  kind: ColumnKind
  /** omitted = shown on both language tabs; else only that tab */
  lang?: 'th' | 'en'
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
}
