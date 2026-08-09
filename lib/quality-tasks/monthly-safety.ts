export type SafetyInspectionProfileKey = 'biohazard_spill_kit' | 'chemical_spill_kit' | 'nss_eyewash'

export type SafetyPointStatus =
  | 'pending'
  | 'due_soon'
  | 'overdue'
  | 'submitted'
  | 'submitted_with_issues'
  | 'skipped'

export type SpillKitItemResult = 'normal' | 'missing' | 'damaged' | 'expired' | 'na'

export interface SpillKitAnswerInput {
  supplyId: string
  itemKey: string
  result: SpillKitItemResult
  expiresOn: string | null
  note: string | null
}

export interface SafetySupplyReplacementInput {
  oldSupplyId: string
  newSupplyId?: string
  internalCode: string
  labelTh: string
  manufacturedOrPackedOn: string | null
  purchasedOn: string | null
  expiresOn: string | null
  supplier: string | null
}

export interface SpillKitInspectionPayload {
  kind: 'spill_kit'
  inspectedOn: string
  answers: SpillKitAnswerInput[]
  correctiveAction?: string | null
  replacements?: SafetySupplyReplacementInput[]
}

export interface NssBottleAnswerInput {
  supplyId: string
  clarity: 'clear' | 'turbid'
  bottleCondition: 'intact' | 'cracked'
  correctiveAction: string | null
}

export interface NssInspectionPayload {
  kind: 'nss'
  activeBottleIds: string[]
  bottles: NssBottleAnswerInput[]
  replacements?: SafetySupplyReplacementInput[]
}

export interface SafetyAssetAssignment {
  userId: string
  assignmentRole: 'primary' | 'backup'
  userName?: string | null
}

export interface SafetySupplyRecord {
  id: string
  assetId: string
  templateItemId: string | null
  supplyType: 'spill_item' | 'nss_bottle'
  internalCode: string
  labelTh: string
  manufacturedOrPackedOn: string | null
  purchasedOn: string | null
  expiresOn: string | null
  supplier: string | null
  activatedOn: string
  retiredOn: string | null
}

export interface MonthlySafetyPoint {
  roundItemId: string
  taskInstanceId: string
  assetId: string
  assetCode: string
  assetName: string
  profile: SafetyInspectionProfileKey
  department: string | null
  dueOn: string
  status: SafetyPointStatus
  issueCount: number
  submittedAt: string | null
  submittedByName: string | null
  assignments: SafetyAssetAssignment[]
}

export interface SafetyAssetProfilePeriod {
  profile: SafetyInspectionProfileKey
  activeFrom: string
  activeTo: string | null
}

const DAY_MS = 86_400_000

function dateAtUtc(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

export function dueDateForMonth(month: string, dueDay: number) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid month')
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) throw new Error('Invalid due day')
  return `${month}-${String(dueDay).padStart(2, '0')}`
}

export function effectiveProfileAt(periods: SafetyAssetProfilePeriod[], date: string) {
  return periods.filter(period => period.activeFrom <= date && (!period.activeTo || period.activeTo >= date))
    .sort((left, right) => right.activeFrom.localeCompare(left.activeFrom))[0]?.profile ?? null
}

export function fiscalMonths(fiscalYear: number) {
  const gregorianEndYear = fiscalYear - 543
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(gregorianEndYear - 1, 9 + index, 1))
    return date.toISOString().slice(0, 7)
  })
}

export function pointStatusForMonth(
  input: { submittedAt: string | null; issueCount: number; skippedAt: string | null; dueOn: string },
  today: string,
): SafetyPointStatus {
  if (input.skippedAt) return 'skipped'
  if (input.submittedAt) return input.issueCount > 0 ? 'submitted_with_issues' : 'submitted'
  const remaining = Math.round((dateAtUtc(input.dueOn).getTime() - dateAtUtc(today).getTime()) / DAY_MS)
  if (remaining < 0) return 'overdue'
  if (remaining <= 7) return 'due_soon'
  return 'pending'
}

export function validateSpillKitSubmission(input: Pick<SpillKitInspectionPayload, 'inspectedOn' | 'answers'>) {
  if (!input.answers.length) return { ok: false as const, error: 'กรุณาตรวจรายการใน Spill kit ให้ครบ' }
  for (const answer of input.answers) {
    if (answer.result === 'normal' && answer.expiresOn && answer.expiresOn < input.inspectedOn) {
      return { ok: false as const, error: 'รายการที่หมดอายุแล้วห้ามบันทึกเป็นปกติ' }
    }
    if (!['normal', 'na'].includes(answer.result) && !answer.note?.trim()) {
      return { ok: false as const, error: 'รายการผิดปกติต้องระบุรายละเอียดหรือการแก้ไข' }
    }
  }
  return { ok: true as const, issueCount: input.answers.filter(answer => !['normal', 'na'].includes(answer.result)).length }
}

export function validateNssSubmission(input: Pick<NssInspectionPayload, 'activeBottleIds' | 'bottles'>) {
  const active = new Set(input.activeBottleIds)
  const submitted = new Set(input.bottles.map(bottle => bottle.supplyId))
  if (active.size !== submitted.size || [...active].some(id => !submitted.has(id))) {
    return { ok: false as const, error: 'กรุณาตรวจขวด NSS ที่ใช้งานอยู่ให้ครบทุกขวด' }
  }
  for (const bottle of input.bottles) {
    const abnormal = bottle.clarity === 'turbid' || bottle.bottleCondition === 'cracked'
    if (abnormal && !bottle.correctiveAction?.trim()) {
      return { ok: false as const, error: 'ขวด NSS ที่ผิดปกติต้องระบุการแก้ไขปัญหา' }
    }
  }
  return {
    ok: true as const,
    issueCount: input.bottles.filter(bottle => bottle.clarity === 'turbid' || bottle.bottleCondition === 'cracked').length,
  }
}

export function validateSupplyReplacements(replacements: SafetySupplyReplacementInput[], abnormalSupplyIds: Set<string>) {
  if (new Set(replacements.map(item => item.oldSupplyId)).size !== replacements.length) {
    return { ok: false as const, error: 'รายการที่เปลี่ยนต้องไม่ซ้ำกัน' }
  }
  if (replacements.some(item => !abnormalSupplyIds.has(item.oldSupplyId))) {
    return { ok: false as const, error: 'เปลี่ยน inventory ได้เฉพาะรายการที่พบปัญหา' }
  }
  if (replacements.some(item => !item.internalCode.trim() || !item.labelTh.trim())) {
    return { ok: false as const, error: 'inventory ใหม่ต้องมีรหัสและชื่อรายการ' }
  }
  return { ok: true as const }
}

export function monthlyPeriod(month: string, dueDay = 15) {
  const [year, monthNumber] = month.split('-').map(Number)
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
  return { start: `${month}-01`, end, dueOn: dueDateForMonth(month, dueDay) }
}
