import { z } from 'zod'
import { bangkokIsoDate, fiscalYearMonthToCalendarYear, isStrictIsoDate } from './pm-cal-domain'

const nullableText = z.string().trim().max(2000).nullable().optional()
const strictDate = z.string().refine(isStrictIsoDate, 'วันที่ไม่ถูกต้อง')

export function parsePmCalFiscalYear(value: string | null, fallback: number): number | null {
  if (value == null || value.trim() === '') return fallback
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 2500 && parsed <= 3000 ? parsed : null
}

const planInputSchema = z.object({
  calendar_month: z.number().int().min(1).max(12),
  cal_type: z.enum(['PM', 'CAL']),
  due_date: strictDate,
  provider: z.string().trim().max(500).nullable().optional(),
  planned_cost: z.number().nonnegative().max(999_999_999.99).nullable().optional(),
  version: z.number().int().positive().nullable().optional(),
})

export const pmCalPlanReplaceSchema = z.object({
  fiscal_year: z.number().int().min(2500).max(3000),
  expected_versions: z.record(z.string().uuid(), z.number().int().positive()),
  plans: z.array(planInputSchema).max(24),
}).superRefine((value, ctx) => {
  if (Object.keys(value.expected_versions).length > 24) {
    ctx.addIssue({ code: 'custom', path: ['expected_versions'], message: 'จำนวนรุ่นแผนไม่ถูกต้อง' })
  }
  const keys = new Set<string>()
  value.plans.forEach((plan, index) => {
    const key = `${plan.cal_type}:${plan.calendar_month}`
    if (keys.has(key)) {
      ctx.addIssue({ code: 'custom', path: ['plans', index], message: 'มีแผนเดือนและประเภทนี้ซ้ำกัน' })
    }
    keys.add(key)

    const [year, month] = plan.due_date.split('-').map(Number)
    const validMonth = Number.isInteger(plan.calendar_month) && plan.calendar_month >= 1 && plan.calendar_month <= 12
    if (validMonth && (year !== fiscalYearMonthToCalendarYear(value.fiscal_year, plan.calendar_month) || month !== plan.calendar_month)) {
      ctx.addIssue({ code: 'custom', path: ['plans', index, 'due_date'], message: 'วันครบกำหนดไม่ตรงกับปีงบประมาณและเดือน' })
    }
  })
})

export const pmCalPlanGroupReplaceSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  fiscal_year: z.number().int().min(2500).max(3000),
  group_name: z.string().trim().min(1).max(200),
  plan_name: z.string().trim().min(1).max(500),
  cal_type: z.enum(['PM', 'CAL']),
  calendar_month: z.number().int().min(1).max(12),
  due_date: strictDate,
  provider: z.string().trim().max(500).nullable().optional(),
  price_mode: z.enum(['per_unit', 'lump_sum']),
  unit_price: z.number().nonnegative().max(999_999_999.99).nullable(),
  planned_amount: z.number().nonnegative().max(999_999_999.99),
  actual_amount: z.number().nonnegative().max(999_999_999.99).nullable().optional(),
  equipment_ids: z.array(z.string().uuid()).min(1).max(1000),
  version: z.number().int().positive().nullable().optional(),
  // Only honored on create (POST): additional months to spin off as sibling groups (same
  // group/plan name, equipment, price) in one action, for equipment that's due PM/CAL more than
  // once a year. Ignored on edit (PATCH), which always targets a single existing group/month.
  extra_months: z.array(z.number().int().min(1).max(12)).max(11).optional(),
}).superRefine((value, ctx) => {
  if (new Set(value.equipment_ids).size !== value.equipment_ids.length) {
    ctx.addIssue({ code: 'custom', path: ['equipment_ids'], message: 'มีเครื่องมือซ้ำในแผน' })
  }
  if (value.extra_months?.includes(value.calendar_month)) {
    ctx.addIssue({ code: 'custom', path: ['extra_months'], message: 'เดือนซ้ำกับเดือนหลัก' })
  }
  if (value.extra_months && new Set(value.extra_months).size !== value.extra_months.length) {
    ctx.addIssue({ code: 'custom', path: ['extra_months'], message: 'เดือนซ้ำกันในรายการ' })
  }
  if (value.price_mode === 'per_unit' && value.unit_price == null) {
    ctx.addIssue({ code: 'custom', path: ['unit_price'], message: 'กรุณาระบุราคาต่อหน่วย' })
  }
  if (value.price_mode === 'lump_sum' && value.unit_price != null) {
    ctx.addIssue({ code: 'custom', path: ['unit_price'], message: 'ราคาเหมารวมต้องไม่มีราคาต่อหน่วย' })
  }
  const [year, month] = value.due_date.split('-').map(Number)
  if (year !== fiscalYearMonthToCalendarYear(value.fiscal_year, value.calendar_month) || month !== value.calendar_month) {
    ctx.addIssue({ code: 'custom', path: ['due_date'], message: 'วันครบกำหนดไม่ตรงกับปีงบประมาณและเดือน' })
  }
})

export const pmCalResultCreateSchema = z.object({
  plan_id: z.string().uuid(),
  cal_type: z.enum(['PM', 'CAL']),
  completed_date: strictDate,
  result: z.enum(['PASS', 'FAIL', 'NOT_PERFORMED']).nullable(),
  tech_group: nullableText,
  purpose: nullableText,
  operating_range: nullableText,
  mpe: nullableText,
  acceptance_criteria: nullableText,
  certificate_no: nullableText,
  error_value: nullableText,
  uncertainty: nullableText,
  remark: nullableText,
  actual_cost: z.number().nonnegative().max(999_999_999.99).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.completed_date > bangkokIsoDate()) {
    ctx.addIssue({ code: 'custom', path: ['completed_date'], message: 'วันที่ดำเนินการต้องไม่เป็นอนาคต' })
  }
  if (value.cal_type === 'CAL' && value.result === null) {
    ctx.addIssue({ code: 'custom', path: ['result'], message: 'CAL ต้องระบุผล' })
  }
  if (value.cal_type === 'PM' && (value.result === 'PASS' || value.result === 'FAIL')) {
    ctx.addIssue({ code: 'custom', path: ['result'], message: 'PM ใช้ผลดำเนินการแล้วหรือไม่ได้ดำเนินการเท่านั้น' })
  }
  if (value.result === 'NOT_PERFORMED' && !value.remark?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['remark'], message: 'กรุณาระบุเหตุผลที่ไม่ได้ดำเนินการ' })
  }
})

export type PmCalPlanReplaceInput = z.infer<typeof pmCalPlanReplaceSchema>
export type PmCalPlanGroupReplaceInput = z.infer<typeof pmCalPlanGroupReplaceSchema>
export type PmCalResultCreateInput = z.infer<typeof pmCalResultCreateSchema>
