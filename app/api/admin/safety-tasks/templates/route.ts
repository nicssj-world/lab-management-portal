import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { getQualityTaskTemplates, saveTemplate } from '@/lib/quality-tasks/server'

const assigneeSchema = z.object({ userId: z.string().uuid().nullable(), manualName: z.string().trim().max(120).nullable() })
const scheduleSchema = z.object({
  id: z.string().default(''), templateId: z.string().default(''), intervalUnit: z.enum(['day', 'week', 'month', 'year']),
  intervalCount: z.number().int().positive(), recurrenceMode: z.enum(['fixed_calendar', 'rolling_completion']),
  startsOn: z.string().date(), endsOn: z.string().date().nullable(), active: z.boolean(),
})
const requirementSchema = z.object({
  id: z.string().default(''), templateId: z.string().default(''), label: z.string().trim().min(1).max(160),
  evidenceKind: z.string().trim().min(1).max(60), required: z.boolean(), minimumFiles: z.number().int().min(1).max(20), sortOrder: z.number().int().min(1),
})
export const safetyTemplateSchema = z.object({
  workstream: z.literal('safety').default('safety'), categoryCode: z.literal('F').default('F'),
  categoryName: z.string().trim().min(1).default('ความปลอดภัย'), activityNo: z.number().int().positive().nullable(),
  title: z.string().trim().min(1).max(240), description: z.string().max(3000).nullable(), referenceCode: z.string().max(200).nullable(),
  frequencyText: z.string().trim().min(1).max(160), ownerText: z.string().max(240), taskKind: z.enum(['activity', 'meeting']),
  approvalMode: z.enum(['none', 'required']), integrationKind: z.enum(['none', 'safety_inspection', 'equipment_reference']),
  approverId: z.string().uuid().nullable(), reminderDays: z.number().int().min(0).max(365), evidenceRequired: z.boolean(), active: z.boolean(),
  defaultAssignees: z.array(assigneeSchema), defaultParticipantDepts: z.array(z.enum(DEPARTMENTS)).default([]),
  defaultParticipantUserIds: z.array(z.string().uuid()).default([]), evidenceRequirements: z.array(requirementSchema), schedules: z.array(scheduleSchema),
})

export async function GET() {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try { return NextResponse.json({ templates: await getQualityTaskTemplates(false, 'safety') }) } catch (error) { return safetyTaskError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    const id = await saveTemplate(safetyTemplateSchema.parse(await req.json()), ctx.actor, undefined, 'safety')
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) { return safetyTaskError(error) }
}
