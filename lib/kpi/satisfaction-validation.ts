import { z } from 'zod'

const metricCodeSchema = z.string()
  .trim()
  .min(1, 'กรุณาระบุรหัสชุดตัวชี้วัด')
  .max(100, 'รหัสชุดตัวชี้วัดยาวเกิน 100 ตัวอักษร')
  .regex(/^[a-z0-9_]+$/, 'รหัสชุดตัวชี้วัดใช้ได้เฉพาะ a-z, 0-9 และ _')

const metricNameSchema = z.string()
  .trim()
  .min(1, 'กรุณาระบุชื่อชุดตัวชี้วัด')
  .max(200, 'ชื่อชุดตัวชี้วัดยาวเกิน 200 ตัวอักษร')

const targetSchema = z.number({ invalid_type_error: 'เป้าหมายต้องเป็นตัวเลข' })
  .finite('เป้าหมายต้องเป็นตัวเลขที่ถูกต้อง')
  .min(0, 'เป้าหมายต้องไม่น้อยกว่า 0')
  .max(100, 'เป้าหมายต้องไม่เกิน 100')

const fiscalYearSchema = z.number({ invalid_type_error: 'ปีงบประมาณต้องเป็นตัวเลข' })
  .int('ปีงบประมาณต้องเป็นจำนวนเต็ม')
  .min(2500, 'ปีงบประมาณต้องอยู่ระหว่าง 2500 ถึง 3000')
  .max(3000, 'ปีงบประมาณต้องอยู่ระหว่าง 2500 ถึง 3000')

type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string }

function validationResult<T>(result: z.SafeParseReturnType<unknown, T>): ValidationResult<T> {
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }
  return { ok: true, data: result.data }
}

const satisfactionSchema = z.object({
  metric_code: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/),
  metric_name: z.string().trim().min(1).max(200),
  fiscal_year: z.number().int().min(2500).max(2999),
  value: z.number().finite().min(0).max(100).nullable(),
  target_val: z.number().finite().min(0).max(100).optional(),
})

export type ValidatedKpiSatisfaction = z.infer<typeof satisfactionSchema>

export function validateKpiSatisfactionPayload(body: unknown):
  | { ok: true; data: ValidatedKpiSatisfaction }
  | { ok: false; error: string } {
  const parsed = satisfactionSchema.safeParse(body)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลความพึงพอใจไม่ถูกต้อง' }
  return { ok: true, data: parsed.data }
}

const satisfactionMetricCreateSchema = z.object({
  name: metricNameSchema,
  target: targetSchema,
}).strict('ข้อมูลสร้างชุดตัวชี้วัดมีฟิลด์ที่ไม่รองรับ')

const satisfactionMetricPatchSchema = z.object({
  code: metricCodeSchema,
  name: metricNameSchema.optional(),
  target: targetSchema.optional(),
  isActive: z.boolean({ invalid_type_error: 'สถานะการใช้งานไม่ถูกต้อง' }).optional(),
}).strict('ข้อมูลแก้ไขมีฟิลด์ที่ไม่รองรับ และไม่สามารถเปลี่ยนรหัสชุดตัวชี้วัดได้')
  .refine((value) => value.name !== undefined || value.target !== undefined || value.isActive !== undefined, {
    message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข',
  })

const manualSatisfactionValueSchema = z.object({
  metricCode: metricCodeSchema,
  fiscalYear: fiscalYearSchema,
  value: z.number({ invalid_type_error: 'ค่าความพึงพอใจต้องเป็นตัวเลข' })
    .finite('ค่าความพึงพอใจต้องเป็นตัวเลขที่ถูกต้อง')
    .min(0, 'ค่าความพึงพอใจต้องไม่น้อยกว่า 0')
    .max(100, 'ค่าความพึงพอใจต้องไม่เกิน 100'),
  sourceNote: z.string()
    .trim()
    .min(1, 'กรุณาระบุแหล่งที่มาของข้อมูล')
    .max(500, 'รายละเอียดแหล่งที่มายาวเกิน 500 ตัวอักษร'),
}).strict('ข้อมูลค่าความพึงพอใจมีฟิลด์ที่ไม่รองรับ')

const dashboardQuerySchema = z.object({
  fiscalYear: z.preprocess(
    (value) => typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
    fiscalYearSchema.optional(),
  ),
  metricCode: metricCodeSchema.optional(),
  source: z.enum(['survey', 'manual'], {
    errorMap: () => ({ message: 'แหล่งข้อมูลต้องเป็น survey หรือ manual' }),
  }).optional(),
  status: z.enum(['pass', 'below', 'missing'], {
    errorMap: () => ({ message: 'สถานะต้องเป็น pass, below หรือ missing' }),
  }).optional(),
}).strict('ตัวกรองมีฟิลด์ที่ไม่รองรับ')

export type ValidatedSatisfactionMetricCreate = z.infer<typeof satisfactionMetricCreateSchema>
export type ValidatedSatisfactionMetricPatch = z.infer<typeof satisfactionMetricPatchSchema>
export type ValidatedManualSatisfactionValue = z.infer<typeof manualSatisfactionValueSchema>
export type ValidatedSatisfactionDashboardQuery = z.infer<typeof dashboardQuerySchema>

export function validateSatisfactionMetricCreate(body: unknown): ValidationResult<ValidatedSatisfactionMetricCreate> {
  return validationResult(satisfactionMetricCreateSchema.safeParse(body))
}

export function validateSatisfactionMetricPatch(body: unknown): ValidationResult<ValidatedSatisfactionMetricPatch> {
  return validationResult(satisfactionMetricPatchSchema.safeParse(body))
}

export function validateManualSatisfactionValue(body: unknown): ValidationResult<ValidatedManualSatisfactionValue> {
  return validationResult(manualSatisfactionValueSchema.safeParse(body))
}

export function validateSatisfactionDashboardQuery(body: unknown): ValidationResult<ValidatedSatisfactionDashboardQuery> {
  return validationResult(dashboardQuerySchema.safeParse(body))
}
