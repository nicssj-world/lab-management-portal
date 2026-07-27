import { fiscalYearMonthToCalendarYear } from './pm-cal-domain'

export type PriceMode = 'per_unit' | 'lump_sum'

export interface PlanGroup {
  id: string
  fiscal_year: number
  group_name: string
  plan_name: string
  cal_type: 'PM' | 'CAL'
  calendar_month: number
  due_date: string
  provider: string | null
  price_mode: PriceMode
  unit_price: number | null
  planned_amount: number
  actual_amount: number | null
  record_status: 'active' | 'cancelled'
  version: number
}

export interface PlanGroupDraft extends Omit<PlanGroup, 'id' | 'record_status' | 'version' | 'actual_amount'> {
  actual_amount: null
  equipment_ids: string[]
  status: 'draft'
}

type LegacyTemplateRow = Pick<PlanGroupDraft, 'group_name' | 'plan_name' | 'price_mode' | 'unit_price' | 'planned_amount'>

export const LEGACY_CALIBRATION_TEMPLATE: LegacyTemplateRow[] = [
  ['1. ตู้ปลอดเชื้อ', 'ตู้ปลอดเชื้อ (Biosafety Cabinet)', 'per_unit', 60990, 914850],
  ['2. ISO 15189', 'เครื่องนึ่งฆ่าเชื้อ (Autoclave)', 'per_unit', 1500, 4500],
  ['2. ISO 15189', 'เครื่องปั่นตกตะกอน (Centrifuge)', 'lump_sum', null, 30000],
  ['2. ISO 15189', 'เครื่องปั่นเม็ดเลือด (Hematocrit)', 'per_unit', 1500, 3000],
  ['2. ISO 15189', 'เครื่องเขย่าสาร (Rotator Shaker)', 'per_unit', 1500, 3000],
  ['2. ISO 15189', 'อ่างน้ำควบคุม (Water Bath)', 'per_unit', 1500, 3000],
  ['2. ISO 15189', 'ตู้เพาะเชื้อ (Incubator)', 'per_unit', 1500, 3000],
  ['2. ISO 15189', 'เครื่องชั่งสาร (Analytical Balance)', 'per_unit', 1500, 1500],
  ['2. ISO 15189', 'ตู้เย็นเก็บส่วนประกอบเลือด', 'per_unit', 2000, 18000],
  ['2. ISO 15189', 'ตู้เย็นเก็บน้ำยา 2 ประตู', 'per_unit', 2000, 36000],
  ['2. ISO 15189', 'Digital Thermometer', 'per_unit', 800, 6400],
  ['2. ISO 15189', 'Thermometer-Hygometer', 'per_unit', 800, 4800],
  ['2. ISO 15189', 'Autopipette', 'per_unit', 1000, 27000],
  ['2. ISO 15189', 'Dry bath / Tube warmer / Heating block', 'per_unit', 2000, 0],
  ['2. ISO 15189', 'เครื่องบ่มเกร็ดเลือด (Platelet Incubator)', 'lump_sum', null, 0],
  ['3. Osmometer', 'Osmometer', 'per_unit', 14000, 14000],
  ['4. Microbilirubin', 'Microbilirubin Meter', 'per_unit', 12000, 24000],
  ['5. กล้องจุลทรรศน์', 'กล้องจุลทรรศน์ (Microscope)', 'lump_sum', null, 30000],
  ['6. ระบบอุณหภูมิ', 'ระบบบันทึกอุณหภูมิอัตโนมัติ', 'lump_sum', null, 38200],
].map(([group_name, plan_name, price_mode, unit_price, planned_amount]) => ({
  group_name: String(group_name), plan_name: String(plan_name), price_mode: price_mode as PriceMode,
  unit_price: unit_price == null ? null : Number(unit_price), planned_amount: Number(planned_amount),
}))

export function calculateGroupPlannedAmount(mode: PriceMode, amount: number, memberCount: number) {
  return mode === 'per_unit' ? amount * memberCount : amount
}

function targetDueDate(source: string | null, fiscalYear: number, month: number) {
  const year = fiscalYearMonthToCalendarYear(fiscalYear, month)
  const sourceDay = source ? Number(source.slice(8, 10)) : 31
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(sourceDay || lastDay, lastDay)).padStart(2, '0')}`
}

export function buildPlanGroupDrafts(source: 'legacy_template' | 'fiscal_year', targetFiscalYear: number, sourceGroups: PlanGroup[] = []): PlanGroupDraft[] {
  const rows = source === 'legacy_template' ? LEGACY_CALIBRATION_TEMPLATE.map(row => ({
    ...row, cal_type: 'CAL' as const, calendar_month: 9, due_date: null as string | null, provider: null,
  })) : sourceGroups.filter(row => row.record_status === 'active')
  return rows.map(row => ({
    fiscal_year: targetFiscalYear, group_name: row.group_name, plan_name: row.plan_name,
    cal_type: row.cal_type, calendar_month: row.calendar_month,
    due_date: targetDueDate(row.due_date, targetFiscalYear, row.calendar_month), provider: row.provider,
    price_mode: row.price_mode, unit_price: row.unit_price, planned_amount: row.planned_amount,
    actual_amount: null, equipment_ids: [], status: 'draft',
  }))
}
