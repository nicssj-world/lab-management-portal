import { z } from 'zod'

const uuid = z.string().uuid()
const isoDate = z.string().date()
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional()

export const evacuationTaskReferenceSchema = z.object({
  instanceId: uuid.nullable().optional(),
  scheduleId: uuid.nullable().optional(),
  periodStart: isoDate.nullable().optional(),
}).superRefine((value, context) => {
  if (value.instanceId) return
  if (!value.scheduleId || !value.periodStart) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['instanceId'], message: 'ต้องเลือกงานที่มีอยู่ หรือระบุรอบงานเพื่อสร้าง occurrence' })
  }
})

export const evacuationAssignmentSchema = z.object({
  scopeType: z.enum(['station', 'space', 'zone']),
  scopeCode: z.string().trim().min(1).max(120),
  exitCode: z.string().trim().min(1).max(80),
  routeVariant: z.enum(['primary', 'alternate']),
  routeCode: nullableText(120),
  assemblyPointId: uuid,
  postExitInstructionTh: nullableText(1000),
  responsibleText: nullableText(240),
})

const planFields = {
  planCode: z.string().trim().min(1).max(80),
  versionCode: z.string().trim().min(1).max(80),
  mapReleaseId: uuid,
  effectiveDate: isoDate.nullable(),
  reviewDueDate: isoDate.nullable(),
  reportPointId: uuid.nullable(),
  headcountResponsible: z.string().trim().max(240).nullable(),
  notes: z.string().trim().max(4000).nullable(),
  reviewTask: evacuationTaskReferenceSchema,
  assignments: z.array(evacuationAssignmentSchema).min(1).max(200),
}

export const createEvacuationPlanSchema = z.object(planFields)
export const updateEvacuationPlanSchema = z.object({ ...planFields, updatedAt: z.string().trim().min(1) })
export const evacuationPlanTransitionSchema = z.object({ action: z.enum(['submit', 'approve', 'publish', 'retire']) })

const drillCycleFields = {
  kind: z.literal('cycle'),
  fiscalYear: z.number().int().min(2500).max(2700),
  planVersionId: uuid,
  ownerText: z.string().trim().min(1).max(240),
  dueDate: isoDate.nullable(),
  notes: z.string().trim().max(4000).nullable(),
  task: evacuationTaskReferenceSchema,
}

export const createDrillCycleSchema = z.object(drillCycleFields)

const drillSessionFields = {
  kind: z.literal('session'),
  cycleId: uuid,
  scenario: z.string().trim().min(1).max(500),
  startedAt: z.string().datetime({ offset: true }).nullable().default(null),
  endedAt: z.string().datetime({ offset: true }).nullable().default(null),
  offHours: z.boolean().default(false),
  scopeCodes: z.array(z.string().trim().min(1).max(120)).max(200).default([]),
  routeCodes: z.array(z.string().trim().min(1).max(120)).max(200).default([]),
  expectedParticipants: z.number().int().min(0).max(10000).default(0),
  actualParticipants: z.number().int().min(0).max(10000).default(0),
  expectedHeadcount: z.number().int().min(0).max(10000).default(0),
  checkedHeadcount: z.number().int().min(0).max(10000).default(0),
  missingHeadcount: z.number().int().min(0).max(10000).default(0),
  injuredCount: z.number().int().min(0).max(10000).default(0),
  reportPointId: uuid.nullable().default(null),
  observerText: z.string().trim().max(240).nullable().default(null),
  evaluation: z.string().trim().max(4000).nullable().default(null),
  compliancePercent: z.number().min(0).max(100).nullable().default(null),
  deviationText: z.string().trim().max(4000).nullable().default(null),
  status: z.enum(['planned', 'completed']).default('planned'),
}

function validateHeadcount(value: { expectedHeadcount?: number; checkedHeadcount?: number; missingHeadcount?: number }, context: z.RefinementCtx) {
  const expected = value.expectedHeadcount
  if (expected == null) return
  if (expected === 0) {
    if ((value.checkedHeadcount ?? 0) > 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkedHeadcount'], message: 'ถ้าไม่ระบุจำนวนที่ต้องนับ จำนวนที่นับได้ต้องเป็นศูนย์' })
    if ((value.missingHeadcount ?? 0) > 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['missingHeadcount'], message: 'ถ้าไม่ระบุจำนวนที่ต้องนับ จำนวนที่ตามไม่พบต้องเป็นศูนย์' })
    return
  }
  if (value.checkedHeadcount != null && value.checkedHeadcount > expected) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkedHeadcount'], message: 'จำนวนที่นับได้ห้ามมากกว่าจำนวนที่ต้องนับ' })
  if (value.missingHeadcount != null && value.missingHeadcount > expected) context.addIssue({ code: z.ZodIssueCode.custom, path: ['missingHeadcount'], message: 'จำนวนที่ตามไม่พบห้ามมากกว่าจำนวนที่ต้องนับ' })
  if (value.checkedHeadcount != null && value.missingHeadcount != null && value.checkedHeadcount + value.missingHeadcount > expected) context.addIssue({ code: z.ZodIssueCode.custom, path: ['missingHeadcount'], message: 'จำนวนที่นับได้รวมกับที่ตามไม่พบห้ามมากกว่าจำนวนที่ต้องนับ' })
}

function validateParticipants(value: { expectedParticipants?: number; actualParticipants?: number }, context: z.RefinementCtx) {
  if (value.expectedParticipants != null && value.actualParticipants != null && value.actualParticipants > value.expectedParticipants) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['actualParticipants'], message: 'ผู้เข้าร่วมจริงต้องไม่มากกว่าผู้เข้าร่วมคาดหมาย' })
  }
}

export const createDrillSessionSchema = z.object(drillSessionFields).superRefine((value, context) => {
  validateHeadcount(value, context)
  validateParticipants(value, context)
})
// The session branch has a cross-field refinement, so it is a ZodEffects value;
// use a regular union instead of discriminatedUnion (which only accepts raw objects).
export const createDrillSchema = z.union([createDrillCycleSchema, createDrillSessionSchema])

export const drillEvidenceSchema = z.object({
  attachmentId: uuid,
  evidenceRole: z.enum(['plan', 'attendance', 'evaluation', 'photo', 'incident']),
})

export const updateDrillSessionSchema = z.object({
  updatedAt: z.string().trim().min(1),
  scenario: z.string().trim().min(1).max(500).optional(),
  startedAt: z.string().datetime({ offset: true }).nullable().optional(),
  endedAt: z.string().datetime({ offset: true }).nullable().optional(),
  offHours: z.boolean().optional(), scopeCodes: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  routeCodes: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  expectedParticipants: z.number().int().min(0).max(10000).optional(), actualParticipants: z.number().int().min(0).max(10000).optional(),
  expectedHeadcount: z.number().int().min(0).max(10000).optional(), checkedHeadcount: z.number().int().min(0).max(10000).optional(),
  missingHeadcount: z.number().int().min(0).max(10000).optional(), injuredCount: z.number().int().min(0).max(10000).optional(),
  reportPointId: uuid.nullable().optional(), observerText: nullableText(240), evaluation: nullableText(4000),
  compliancePercent: z.number().min(0).max(100).nullable().optional(), deviationText: nullableText(4000),
  status: z.enum(['planned', 'completed']).optional(), evidence: z.array(drillEvidenceSchema).max(100).optional(),
}).superRefine((value, context) => {
  validateHeadcount(value, context)
  validateParticipants(value, context)
})
