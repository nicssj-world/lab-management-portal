import { z } from 'zod'
import {
  SAFETY_ACKS,
  SAFETY_LABEL,
  SAFETY_POLICY_PROMPT,
} from './constants'

const OPTION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/

export const visitorFormOptionSchema = z.object({
  id: z.string().regex(OPTION_ID_PATTERN, 'รูปแบบรหัสตัวเลือกไม่ถูกต้อง'),
  label: z.string().trim().min(1, 'กรุณาระบุชื่อตัวเลือก').max(100, 'ชื่อตัวเลือกยาวเกิน 100 ตัวอักษร'),
}).strict()

const safetyOptionSchema = visitorFormOptionSchema.extend({
  id: z.enum(SAFETY_ACKS).or(z.string().regex(OPTION_ID_PATTERN)),
  outcome: z.enum(SAFETY_ACKS),
}).strict()

export const visitorFormConfigSchema = z.object({
  activity_options: z.array(visitorFormOptionSchema).max(30, 'เพิ่มตัวเลือกกิจกรรมได้ไม่เกิน 30 รายการ').default([]),
  contact_dept_options: z.array(visitorFormOptionSchema).max(30, 'เพิ่มตัวเลือกหน่วยงานได้ไม่เกิน 30 รายการ').default([]),
  safety_policy_prompt: z.string().trim().min(1, 'กรุณาระบุคำถามนโยบายความปลอดภัย').max(500, 'คำถามนโยบายความปลอดภัยยาวเกิน 500 ตัวอักษร').default(SAFETY_POLICY_PROMPT),
  safety_options: z.array(safetyOptionSchema).min(1, 'ต้องมีตัวเลือกนโยบายความปลอดภัยอย่างน้อย 1 รายการ').max(10, 'เพิ่มตัวเลือกนโยบายความปลอดภัยได้ไม่เกิน 10 รายการ').default(
    SAFETY_ACKS.map((id) => ({ id, label: SAFETY_LABEL[id], outcome: id })),
  ),
}).strict()

export type VisitorFormOption = z.infer<typeof visitorFormOptionSchema>
export type VisitorSafetyOption = z.infer<typeof safetyOptionSchema>
export type VisitorFormConfig = z.infer<typeof visitorFormConfigSchema>

export const DEFAULT_VISITOR_FORM_CONFIG: VisitorFormConfig = {
  activity_options: [],
  contact_dept_options: [],
  safety_policy_prompt: SAFETY_POLICY_PROMPT,
  safety_options: SAFETY_ACKS.map((id) => ({ id, label: SAFETY_LABEL[id], outcome: id })),
}

export const CUSTOM_ACTIVITY_PREFIX = 'custom_activity:'

export function customActivityValue(id: string) {
  return `${CUSTOM_ACTIVITY_PREFIX}${id}`
}

function uniqueOptions(options: VisitorFormOption[]) {
  const seenIds = new Set<string>()
  const seenLabels = new Set<string>()
  return options.filter((option) => {
    const labelKey = option.label.trim().toLocaleLowerCase()
    if (seenIds.has(option.id) || seenLabels.has(labelKey)) return false
    seenIds.add(option.id)
    seenLabels.add(labelKey)
    return true
  })
}

function uniqueSafetyOptions(options: VisitorSafetyOption[]) {
  const seenIds = new Set<string>()
  const seenLabels = new Set<string>()
  return options.filter((option) => {
    const labelKey = option.label.trim().toLocaleLowerCase()
    if (seenIds.has(option.id) || seenLabels.has(labelKey)) return false
    seenIds.add(option.id)
    seenLabels.add(labelKey)
    return true
  })
}

/** Keep a malformed/legacy JSON value from breaking the public QR form. */
export function normalizeVisitorFormConfig(value: unknown): VisitorFormConfig {
  const parsed = visitorFormConfigSchema.safeParse(value ?? {})
  if (!parsed.success) return { ...DEFAULT_VISITOR_FORM_CONFIG, activity_options: [], contact_dept_options: [] }
  const safetyOptions = uniqueSafetyOptions(parsed.data.safety_options).map((option) => (
    SAFETY_ACKS.includes(option.id as typeof SAFETY_ACKS[number])
      ? { ...option, outcome: option.id as typeof SAFETY_ACKS[number] }
      : option
  ))
  return {
    activity_options: uniqueOptions(parsed.data.activity_options),
    contact_dept_options: uniqueOptions(parsed.data.contact_dept_options),
    safety_policy_prompt: parsed.data.safety_policy_prompt,
    safety_options: safetyOptions,
  }
}
