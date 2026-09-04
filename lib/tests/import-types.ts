import type { TestExcelField } from './excel'

export interface ImportRow {
  id?: number | null
  code: string
  lis_code?: string | null
  cgd?: string | null
  th: string
  en?: string | null
  short_name?: string | null
  loinc?: string | null
  category?: string | null
  category_id?: string | null
  department?: string | null
  active?: boolean | null
  popular?: boolean | null
  price?: number | null
  tat_minutes?: string | null
  urgent_tat_minutes?: string | null
  available_24hr?: boolean | null
  service?: string | null
  method?: string | null
  instrument?: string | null
  methodology_note?: string | null
  tube?: string | null
  tube_color?: string | null
  volume?: string | null
  stability?: string | null
  transport_condition?: string | null
  reject?: string | null
  specimen_note?: string | null
  ref?: string | null
  ref_note?: string | null
  description?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  contact_note?: string | null
  contact_staff?: boolean | null
  _fields?: TestExcelField[]
  _status: 'ok' | 'error'
  _error?: string
  _rowNum: number
}
